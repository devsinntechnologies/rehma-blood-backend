import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { AppStorageService, NotificationRecord } from '../storage/app-storage.service';
import { NotificationsGateway } from './notifications.gateway';

export type NotificationRecipient = {
  role: 'superadmin' | 'donor' | 'user';
  userId: number;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly appStorageService: AppStorageService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  findAll(recipient: NotificationRecipient) {
    return this.appStorageService.listNotifications(recipient.role, recipient.userId);
  }

  getUnreadCount(recipient: NotificationRecipient) {
    return this.appStorageService.getUnreadNotificationCount(recipient.role, recipient.userId);
  }

  create(input: {
    recipient: NotificationRecipient;
    type: NotificationRecord['type'];
    title: string;
    message: string;
    entityType?: string | null;
    entityId?: number | null;
    metadata?: Record<string, unknown> | null;
  }) {
    const notification = this.appStorageService.addNotification({
      recipientRole: input.recipient.role,
      recipientUserId: input.recipient.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
    });

    this.notificationsGateway.emitNotification(notification);
    this.notificationsGateway.emitUnreadCount(
      notification.recipientRole,
      notification.recipientUserId,
      this.appStorageService.getUnreadNotificationCount(notification.recipientRole, notification.recipientUserId),
    );

    return notification;
  }

  createMany(
    recipients: NotificationRecipient[],
    input: {
      type: NotificationRecord['type'];
      title: string;
      message: string;
      entityType?: string | null;
      entityId?: number | null;
      metadata?: Record<string, unknown> | null;
    },
  ) {
    return recipients.map((recipient) =>
      this.create({
        recipient,
        type: input.type,
        title: input.title,
        message: input.message,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
      }),
    );
  }

  notifySuperAdmins(input: {
    type: NotificationRecord['type'];
    title: string;
    message: string;
    entityType?: string | null;
    entityId?: number | null;
    metadata?: Record<string, unknown> | null;
  }) {
    const recipients = this.appStorageService.listSuperAdmins().map((superAdmin) => ({ role: 'superadmin' as const, userId: superAdmin.id }));
    if (!recipients.length) {
      return [];
    }
    return this.createMany(recipients, input);
  }

  markAsRead(id: number, recipient: NotificationRecipient) {
    const notification = this.appStorageService.getNotification(id);
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    if (notification.recipientRole !== recipient.role || notification.recipientUserId !== recipient.userId) {
      throw new ForbiddenException('You cannot update this notification');
    }

    const updated = this.appStorageService.markNotificationAsRead(id);
    if (!updated) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    this.notificationsGateway.emitNotificationUpdate(updated);
    this.notificationsGateway.emitUnreadCount(recipient.role, recipient.userId, this.getUnreadCount(recipient));
    return updated;
  }

  markAllAsRead(recipient: NotificationRecipient) {
    const updated = this.appStorageService.markAllNotificationsAsRead(recipient.role, recipient.userId);
    this.notificationsGateway.emitUnreadCount(recipient.role, recipient.userId, 0);
    return {
      message: 'All notifications marked as read',
      updatedCount: updated.length,
    };
  }
}