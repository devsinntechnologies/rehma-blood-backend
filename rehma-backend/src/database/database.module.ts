import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BloodDonation } from './entities/blood-donation.entity';
import { BloodRequest } from './entities/blood-request.entity';
import { Donor } from './entities/donor.entity';
import { SuperAdmin } from './entities/superadmin.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { SuperAdminService } from './superadmin.service';
import { AppUser } from './entities/app-user.entity';
import { Notification } from './entities/notification.entity';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatAttachment } from './entities/chat-attachment.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RequestParticipation } from './entities/request-participation.entity';
import { IdempotencyRecordEntity } from './entities/idempotency-record.entity';
import { NotificationEvent } from './entities/notification-event.entity';
import { DeviceToken } from './entities/device-token.entity';
import { ParticipationAudit } from './entities/participation-audit.entity';

const ENTITIES = [
  SuperAdmin,
  Donor,
  BloodRequest,
  BloodDonation,
  ActivityLog,
  AppUser,
  Notification,
  ChatConversation,
  ChatMessage,
  ChatAttachment,
  PasswordResetToken,
  RequestParticipation,
  IdempotencyRecordEntity,
  NotificationEvent,
  DeviceToken,
  ParticipationAudit,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST', 'localhost'),
        port: configService.get<number>('DATABASE_PORT', 5435),
        username: configService.get<string>('DATABASE_USER', 'postgres'),
        password: configService.get<string>('DATABASE_PASSWORD', 'postgres'),
        database: configService.get<string>('DATABASE_NAME', 'rehma_blood'),
        entities: ENTITIES,
        synchronize: configService.get<string>('TYPEORM_SYNCHRONIZE', 'false') === 'true',
      }),
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  providers: [SuperAdminService],
  exports: [SuperAdminService, TypeOrmModule],
})
export class DatabaseModule {}