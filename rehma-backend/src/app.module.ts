import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BloodDonationsModule } from './blood-donations/blood-donations.module';
import { BloodRequestsModule } from './blood-requests/blood-requests.module';
import { DonorAuthModule } from './donor-auth/donor-auth.module';
import { UserAuthModule } from './user-auth/user-auth.module';
import { DonorsModule } from './donors/donors.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { MapModule } from './map/map.module';
import { StorageModule } from './storage/storage.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    DatabaseModule,
    AuthModule,
    DonorAuthModule,
    UserAuthModule,
    DashboardModule,
    StorageModule,
    DonorsModule,
    BloodRequestsModule,
    BloodDonationsModule,
    MapModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}