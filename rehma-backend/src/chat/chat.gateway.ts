import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import { MarkChatReadDto } from './dto/mark-chat-read.dto';
import { UpdateChatParticipantStateDto } from './dto/update-chat-participant-state.dto';

export type ChatSocketUser = {
  sub: number;
  email: string;
  role: 'superadmin' | 'donor' | 'user';
};

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.resolveToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const user = await this.jwtService.verifyAsync<ChatSocketUser>(token);
      client.data.user = user;
      await client.join(this.userRoom(user.role, user.sub));
      client.emit('chat:connected', {
        user,
        unreadCount: this.chatService.getUnreadCount({ role: user.role, userId: user.sub }).unreadCount,
      });
    } catch (error) {
      this.logger.warn(`Rejected chat socket connection: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const user = client.data.user as ChatSocketUser | undefined;
    if (user) {
      this.logger.debug(`Chat socket disconnected: ${user.role}:${user.sub}`);
    }
  }

  @SubscribeMessage('chat:join')
  async joinConversation(@ConnectedSocket() client: Socket, @MessageBody() payload: { conversationId: number }) {
    const user = this.requireSocketUser(client);
    const conversation = this.chatService.getConversation(Number(payload.conversationId), { role: user.role, userId: user.sub });
    await client.join(this.conversationRoom(conversation.id));
    client.emit('chat:joined', { conversation });
    return { conversation };
  }

  @SubscribeMessage('chat:leave')
  async leaveConversation(@ConnectedSocket() client: Socket, @MessageBody() payload: { conversationId: number }) {
    const user = this.requireSocketUser(client);
    const room = this.conversationRoom(Number(payload.conversationId));
    await client.leave(room);
    client.emit('chat:left', { conversationId: Number(payload.conversationId), user });
    return { conversationId: Number(payload.conversationId) };
  }

  @SubscribeMessage('chat:typing')
  async typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: number; isTyping: boolean },
  ) {
    const user = this.requireSocketUser(client);
    const conversation = this.chatService.setTyping(Number(payload.conversationId), { role: user.role, userId: user.sub }, Boolean(payload.isTyping));
    this.server.to(this.conversationRoom(conversation.id)).emit('chat:typing', {
      conversationId: conversation.id,
      userId: user.sub,
      role: user.role,
      isTyping: Boolean(payload.isTyping),
    });
    return { conversationId: conversation.id, isTyping: Boolean(payload.isTyping) };
  }

  @SubscribeMessage('chat:read')
  async read(@ConnectedSocket() client: Socket, @MessageBody() payload: { conversationId: number; lastReadMessageId?: number }) {
    const user = this.requireSocketUser(client);
    const result = this.chatService.markAsRead(Number(payload.conversationId), { role: user.role, userId: user.sub }, { lastReadMessageId: payload.lastReadMessageId });
    this.server.to(this.conversationRoom(result.conversation.id)).emit('chat:read', {
      conversationId: result.conversation.id,
      role: user.role,
      userId: user.sub,
      lastReadMessageId: result.lastReadMessageId,
      unreadCount: result.unreadCount,
    });
    this.server.to(this.userRoom(user.role, user.sub)).emit('chat:unread-count', {
      unreadCount: result.unreadCount,
    });
    return result;
  }

  @SubscribeMessage('chat:message')
  async message(@ConnectedSocket() client: Socket, @MessageBody() payload: { conversationId: number; body?: string; messageType?: SendChatMessageDto['messageType']; replyToMessageId?: number }) {
    const user = this.requireSocketUser(client);
    const created = await this.chatService.sendMessage(
      Number(payload.conversationId),
      { role: user.role, userId: user.sub },
      {
        body: payload.body,
        messageType: payload.messageType,
        replyToMessageId: payload.replyToMessageId,
      },
      [],
    );
    this.broadcastMessage(Number(payload.conversationId), created);
    return created;
  }

  @SubscribeMessage('chat:state')
  async state(@ConnectedSocket() client: Socket, @MessageBody() payload: { conversationId: number } & UpdateChatParticipantStateDto) {
    const user = this.requireSocketUser(client);
    const conversation = this.chatService.updateParticipantState(Number(payload.conversationId), { role: user.role, userId: user.sub }, {
      archived: payload.archived,
      muted: payload.muted,
    });
    this.server.to(this.userRoom(user.role, user.sub)).emit('chat:conversation-updated', { conversation });
    return { conversation };
  }

  broadcastMessage(conversationId: number, message: unknown): void {
    this.server.to(this.conversationRoom(conversationId)).emit('chat:message', message);
  }

  broadcastConversation(conversation: { id: number }): void {
    this.server.to(this.conversationRoom(conversation.id)).emit('chat:conversation-updated', conversation);
  }

  broadcastUnreadCount(role: 'superadmin' | 'donor' | 'user', userId: number, unreadCount: number): void {
    this.server.to(this.userRoom(role, userId)).emit('chat:unread-count', { unreadCount });
  }

  broadcastTyping(conversationId: number, payload: { role: 'superadmin' | 'donor' | 'user'; userId: number; isTyping: boolean }): void {
    this.server.to(this.conversationRoom(conversationId)).emit('chat:typing', {
      conversationId,
      ...payload,
    });
  }

  private resolveToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.replace(/^Bearer\s+/i, '');
    }

    const headerToken = client.handshake.headers.authorization;
    if (typeof headerToken === 'string' && headerToken.trim()) {
      return headerToken.replace(/^Bearer\s+/i, '');
    }

    const queryToken = client.handshake.query.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken.replace(/^Bearer\s+/i, '');
    }

    return null;
  }

  private requireSocketUser(client: Socket): ChatSocketUser {
    const user = client.data.user as ChatSocketUser | undefined;
    if (!user) {
      throw new Error('Socket user not authenticated');
    }

    return user;
  }

  private conversationRoom(conversationId: number): string {
    return `chat:conversation:${conversationId}`;
  }

  private userRoom(role: 'superadmin' | 'donor' | 'user', userId: number): string {
    return `chat:user:${role}:${userId}`;
  }
}
