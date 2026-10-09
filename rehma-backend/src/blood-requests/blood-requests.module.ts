import { Module } from '@nestjs/common';
import { BloodRequestsController } from './blood-requests.controller';
import { BloodRequestsService } from './blood-requests.service';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ParticipationLifecycleService } from './participation-lifecycle.service';
import { ParticipationMigrationService } from './participation-migration.service';
import { ParticipationsController } from './participations.controller';
import { IdempotencyService } from '../shared/idempotency.service';
import { InviteExpiryService } from './invite-expiry.service';
import { ParticipationInviteService } from './participation-invite.service';
import {
  CompositePushDeliveryProvider,
  MockPushDeliveryProvider,
  PushDeliveryService,
} from '../notifications/push-delivery.service';
import { FcmPushDeliveryProvider } from '../notifications/fcm-push-delivery.provider';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [StorageModule, NotificationsModule, ConfigModule],
  controllers: [BloodRequestsController, ParticipationsController],
  providers: [
    BloodRequestsService,
    ParticipationLifecycleService,
    ParticipationMigrationService,
    IdempotencyService,
    InviteExpiryService,
    ParticipationInviteService,
    MockPushDeliveryProvider,
    FcmPushDeliveryProvider,
    CompositePushDeliveryProvider,
    PushDeliveryService,
  ],
  exports: [BloodRequestsService, ParticipationLifecycleService, ParticipationInviteService],
})
export class BloodRequestsModule {}
