import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserAuthService } from './user-auth.service';
import { UserAuthController } from './user-auth.controller';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BloodRequestsModule } from '../blood-requests/blood-requests.module';
import { PasswordResetService } from '../shared/password-reset.service';

@Module({
  imports: [
    StorageModule,
    NotificationsModule,
    BloodRequestsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [UserAuthService, PasswordResetService],
  controllers: [UserAuthController],
})
export class UserAuthModule {}
