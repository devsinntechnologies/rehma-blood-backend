import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export type NotificationUser = {
  sub: number;
  email: string;
  role: 'superadmin' | 'donor' | 'user';
};

@Injectable()
@WebSocketGateway({ namespace: '/notifications', cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.resolveToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const user = await this.jwtService.verifyAsync<NotificationUser>(token);
      client.data.user = user;
      const room = this.getRoom(user.role, user.sub);
      await client.join(room);

      client.emit('notifications:connected', {
        room,
        user,
      });
    } catch (error) {
      this.logger.warn(`Rejected notification socket connection: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const user = client.data.user as NotificationUser | undefined;
    if (user) {
      this.logger.debug(`Notification socket disconnected: ${user.role}:${user.sub}`);
    }
  }

  emitNotification(notification: {
    recipientRole: 'superadmin' | 'donor' | 'user';
    recipientUserId: number;
    [key: string]: unknown;
  }): void {
    this.server?.to(this.getRoom(notification.recipientRole, notification.recipientUserId)).emit('notification:new', notification);
  }

  emitNotificationUpdate(notification: {
    recipientRole: 'superadmin' | 'donor' | 'user';
    recipientUserId: number;
    [key: string]: unknown;
  }): void {
    this.server?.to(this.getRoom(notification.recipientRole, notification.recipientUserId)).emit('notification:updated', notification);
  }

  emitUnreadCount(recipientRole: 'superadmin' | 'donor' | 'user', recipientUserId: number, unreadCount: number): void {
    this.server?.to(this.getRoom(recipientRole, recipientUserId)).emit('notification:unread-count', {
      recipientRole,
      recipientUserId,
      unreadCount,
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

  private getRoom(role: 'superadmin' | 'donor' | 'user', userId: number): string {
    return `notifications:${role}:${userId}`;
  }
}