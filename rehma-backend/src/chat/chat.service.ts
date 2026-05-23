import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { AppStorageService, ChatConversationRecord, ChatMessageRecord, ChatParticipantRecord } from '../storage/app-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateChatConversationDto } from './dto/create-chat-conversation.dto';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import { ListChatMessagesDto } from './dto/list-chat-messages.dto';
import { UpdateChatParticipantStateDto } from './dto/update-chat-participant-state.dto';
import { MarkChatReadDto } from './dto/mark-chat-read.dto';

type ChatAccount = {
  role: 'superadmin' | 'donor' | 'user';
  userId: number;
};

type ChatAccountProfile = ChatAccount & {
  fullName: string;
  avatarUrl?: string | null;
};

export type ChatUploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class ChatService {
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'chat');

  constructor(
    private readonly storageService: AppStorageService,
    private readonly notificationsService: NotificationsService,
  ) {
    mkdirSync(this.uploadsDir, { recursive: true });
  }

  listConversations(account: ChatAccount) {
    return this.storageService.listChatConversations(account.role, account.userId).map((conversation) => this.serializeConversation(conversation, account));
  }

  getConversation(conversationId: number, account: ChatAccount) {
    const conversation = this.requireConversationMember(conversationId, account);
    return this.serializeConversation(conversation, account);
  }

  createConversation(account: ChatAccount, input: CreateChatConversationDto) {
    const conversation = this.storageService.createChatConversation({
      type: input.type,
      title: input.title?.trim() || null,
      contextType: input.contextType?.trim() || null,
      contextId: input.contextId ?? null,
      createdByRole: account.role,
      createdByUserId: account.userId,
      participants: input.participants.map((participant) => ({
        role: participant.role,
        userId: participant.userId,
      })),
    });

    const summary = this.serializeConversation(conversation, account);

    if (conversation.createdByUserId === account.userId && conversation.createdByRole === account.role) {
      const recipients = conversation.participants.filter((participant) => !(participant.role === account.role && participant.userId === account.userId));
      if (recipients.length) {
        this.notificationsService.createMany(
          recipients.map((participant) => ({ role: participant.role, userId: participant.userId })),
          {
            type: 'chat_conversation_created',
            title: 'New chat conversation',
            message: `${summary.title ?? 'A chat conversation'} was created.`,
            entityType: 'chat_conversation',
            entityId: conversation.id,
            metadata: { conversation: summary },
          },
        );
      }
    }

    return summary;
  }

  listMessages(conversationId: number, account: ChatAccount, query: ListChatMessagesDto) {
    const conversation = this.requireConversationMember(conversationId, account);
    const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 100);
    const messages = this.storageService.listChatMessages(conversationId);

    const filteredMessages = query.beforeMessageId
      ? (() => {
          const boundaryIndex = messages.findIndex((message) => message.id === query.beforeMessageId);
          return boundaryIndex >= 0 ? messages.slice(0, boundaryIndex) : messages;
        })()
      : messages;

    const page = filteredMessages.slice(Math.max(filteredMessages.length - limit, 0));

    return {
      items: page.map((message) => this.serializeMessage(message, conversation)),
      total: filteredMessages.length,
      hasMore: filteredMessages.length > page.length,
      nextCursor: page[0]?.id ?? null,
    };
  }

  async sendMessage(conversationId: number, account: ChatAccount, input: SendChatMessageDto, files: ChatUploadFile[] = []) {
    const conversation = this.requireConversationMember(conversationId, account);
    const text = input.body?.trim() ?? '';

    if (!text && !files.length) {
      throw new BadRequestException('Message body or attachment is required');
    }

    const attachmentDescriptors = await this.persistAttachments(files);
    const hasAttachments = attachmentDescriptors.length > 0;
    const inferredType = this.inferMessageType(input.messageType, text, attachmentDescriptors);

    const sender = this.resolveAccountProfile(account);
    const message = this.storageService.addChatMessage({
      conversationId,
      senderRole: account.role,
      senderUserId: account.userId,
      senderName: sender.fullName,
      body: text || null,
      messageType: inferredType,
      replyToMessageId: input.replyToMessageId ?? null,
      attachments: attachmentDescriptors.map((attachment) => ({
        originalName: attachment.originalName,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        kind: attachment.kind,
        size: attachment.size,
        url: '',
        previewUrl: attachment.previewUrl ?? null,
        durationMs: attachment.durationMs ?? null,
        width: attachment.width ?? null,
        height: attachment.height ?? null,
      })),
    });

    if (!message) {
      throw new ForbiddenException('You cannot send messages to this conversation');
    }

    const updatedConversation = this.requireConversationMember(conversationId, account);
    const serialized = this.serializeMessage(message, updatedConversation);
    this.notifyConversationParticipants(updatedConversation, account, serialized);

    return serialized;
  }

  markAsRead(conversationId: number, account: ChatAccount, input: MarkChatReadDto) {
    const conversation = this.requireConversationMember(conversationId, account);
    const updated = this.storageService.markChatConversationRead(conversationId, account.role, account.userId, input.lastReadMessageId ?? null);

    if (!updated) {
      throw new NotFoundException(`Conversation with ID ${conversationId} not found`);
    }

    return {
      conversation: this.serializeConversation(updated, account),
      unreadCount: this.storageService.getChatUnreadCount(account.role, account.userId),
      lastReadMessageId: input.lastReadMessageId ?? conversation.lastMessageId ?? null,
    };
  }

  updateParticipantState(conversationId: number, account: ChatAccount, input: UpdateChatParticipantStateDto) {
    const updated = this.storageService.updateChatParticipantState(conversationId, account.role, account.userId, {
      archived: input.archived,
      muted: input.muted,
    });

    if (!updated) {
      throw new NotFoundException(`Conversation with ID ${conversationId} not found`);
    }

    return this.serializeConversation(updated, account);
  }

  setTyping(conversationId: number, account: ChatAccount, isTyping: boolean) {
    const updated = this.storageService.setChatParticipantTyping(conversationId, account.role, account.userId, isTyping);

    if (!updated) {
      throw new NotFoundException(`Conversation with ID ${conversationId} not found`);
    }

    return this.serializeConversation(updated, account);
  }

  getUnreadCount(account: ChatAccount) {
    return {
      unreadCount: this.storageService.getChatUnreadCount(account.role, account.userId),
    };
  }

  getAttachment(attachmentId: number) {
    const attachment = this.storageService.getChatAttachment(attachmentId);
    if (!attachment) {
      throw new NotFoundException(`Attachment with ID ${attachmentId} not found`);
    }

    const filePath = join(this.uploadsDir, attachment.fileName);
    if (!existsSync(filePath)) {
      throw new NotFoundException('Attachment file not found');
    }

    return { attachment, filePath };
  }

  getConversationParticipants(conversationId: number, account: ChatAccount): ChatParticipantRecord[] {
    const conversation = this.requireConversationMember(conversationId, account);
    return [...conversation.participants];
  }

  private requireConversationMember(conversationId: number, account: ChatAccount): ChatConversationRecord {
    const conversation = this.storageService.getChatConversation(conversationId);
    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${conversationId} not found`);
    }

    const participant = conversation.participants.find((item) => item.role === account.role && item.userId === account.userId);
    if (!participant) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    return conversation;
  }

  private resolveAccountProfile(account: ChatAccount): ChatAccountProfile {
    if (account.role === 'superadmin') {
      const superAdmin = this.storageService.getSuperAdminById(account.userId);
      if (!superAdmin) {
        throw new NotFoundException(`Superadmin with ID ${account.userId} not found`);
      }

      return {
        ...account,
        fullName: superAdmin.fullName,
        avatarUrl: null,
      };
    }

    if (account.role === 'donor') {
      const donor = this.storageService.getDonor(account.userId);
      if (!donor) {
        throw new NotFoundException(`Donor with ID ${account.userId} not found`);
      }

      return {
        ...account,
        fullName: donor.fullName,
        avatarUrl: donor.profileImage ?? null,
      };
    }

    const user = this.storageService.getUserById(account.userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${account.userId} not found`);
    }

    return {
      ...account,
      fullName: user.fullName,
      avatarUrl: null,
    };
  }

  private serializeConversation(conversation: ChatConversationRecord, account: ChatAccount) {
    const participant = conversation.participants.find((item) => item.role === account.role && item.userId === account.userId);

    return {
      ...conversation,
      unreadCount: participant?.unreadCount ?? 0,
      archived: participant?.archived ?? false,
      muted: participant?.muted ?? false,
      isTyping: participant?.isTyping ?? false,
      participants: conversation.participants.map((item) => ({
        ...item,
      })),
    };
  }

  private serializeMessage(message: ChatMessageRecord, conversation: ChatConversationRecord) {
    return {
      ...message,
      readBy: conversation.participants
        .filter((participant) => participant.lastReadMessageId != null && participant.lastReadMessageId >= message.id)
        .map((participant) => ({
          role: participant.role,
          userId: participant.userId,
          displayName: participant.displayName,
          readAt: participant.lastReadMessageId === message.id ? message.createdAt : conversation.lastMessageAt ?? message.createdAt,
        })),
    };
  }

  private async persistAttachments(files: ChatUploadFile[]) {
    if (!files.length) {
      return [];
    }

    const savedFiles = [] as Array<{
      originalName: string;
      fileName: string;
      mimeType: string;
      kind: 'image' | 'video' | 'audio' | 'file';
      size: number;
      previewUrl?: string | null;
      durationMs?: number | null;
      width?: number | null;
      height?: number | null;
    }>;

    for (const file of files) {
      const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}-${randomUUID()}-${safeOriginalName}`;
      const filePath = join(this.uploadsDir, fileName);
      await writeFile(filePath, file.buffer);

      const kind = this.classifyAttachmentKind(file.mimetype);
      savedFiles.push({
        originalName: file.originalname,
        fileName,
        mimeType: file.mimetype,
        kind,
        previewUrl: null,
        size: file.size,
        durationMs: kind === 'audio' || kind === 'video' ? null : null,
        width: null,
        height: null,
      });
    }

    return savedFiles;
  }

  private classifyAttachmentKind(mimeType: string): 'image' | 'video' | 'audio' | 'file' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'file';
  }

  private inferMessageType(
    requestedType: SendChatMessageDto['messageType'] | undefined,
    body: string,
    attachments: Array<{ kind: 'image' | 'video' | 'audio' | 'file' }>,
  ): ChatMessageRecord['messageType'] {
    if (requestedType) {
      return requestedType;
    }

    if (!attachments.length) {
      return 'text';
    }

    if (attachments.length > 1) {
      return 'mixed';
    }

    if (attachments[0].kind === 'audio') {
      return body ? 'mixed' : 'voice';
    }

    if (body) {
      return 'mixed';
    }

    return attachments[0].kind;
  }

  private notifyConversationParticipants(conversation: ChatConversationRecord, sender: ChatAccount, message: { body?: string | null }) {
    const senderSummary = this.resolveAccountProfile(sender);
    const recipients = conversation.participants.filter((participant) => !(participant.role === sender.role && participant.userId === sender.userId));

    if (!recipients.length) {
      return;
    }

    this.notificationsService.createMany(
      recipients.map((participant) => ({ role: participant.role, userId: participant.userId })),
      {
        type: 'chat_message',
        title: `New message from ${senderSummary.fullName}`,
        message: message.body?.trim() || 'Sent an attachment',
        entityType: 'chat_conversation',
        entityId: conversation.id,
        metadata: {
          conversationId: conversation.id,
          message,
        },
      },
    );
  }
}
