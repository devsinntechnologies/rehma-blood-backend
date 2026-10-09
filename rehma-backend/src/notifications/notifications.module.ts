import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageModule } from '../storage/storage.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import {
  CompositePushDeliveryProvider,
  MockPushDeliveryProvider,
  PushDeliveryService,
} from './push-delivery.service';
import { FcmPushDeliveryProvider } from './fcm-push-delivery.provider';

@Global()
@Module({
  imports: [
    ConfigModule,
    StorageModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsGateway,
    NotificationsService,
    MockPushDeliveryProvider,
    FcmPushDeliveryProvider,
    CompositePushDeliveryProvider,
    PushDeliveryService,
  ],
  exports: [
    NotificationsService,
    NotificationsGateway,
    PushDeliveryService,
    MockPushDeliveryProvider,
    CompositePushDeliveryProvider,
  ],
})
export class NotificationsModule {}