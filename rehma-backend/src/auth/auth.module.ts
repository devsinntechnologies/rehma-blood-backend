import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SuperAdminAuthController } from './superadmin-auth.controller';
import { SuperAdminAuthService } from './superadmin-auth.service';
import { JwtStrategy } from './jwt.strategy';
import { SuperAdminProfileController } from './superadmin-profile.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    StorageModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') ?? '1d',
        },
      }),
    }),
  ],
  controllers: [SuperAdminAuthController, SuperAdminProfileController],
  providers: [SuperAdminAuthService, JwtStrategy],
  exports: [SuperAdminAuthService],
})
export class AuthModule {}