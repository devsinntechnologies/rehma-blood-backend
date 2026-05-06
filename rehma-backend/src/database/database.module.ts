import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BloodDonation } from './entities/blood-donation.entity';
import { BloodRequest } from './entities/blood-request.entity';
import { Donor } from './entities/donor.entity';
import { SuperAdmin } from './entities/superadmin.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { SuperAdminService } from './superadmin.service';

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
        entities: [SuperAdmin, Donor, BloodRequest, BloodDonation, ActivityLog],
        synchronize: true, // Set to false in production
      }),
    }),
    TypeOrmModule.forFeature([SuperAdmin, Donor, BloodRequest, BloodDonation, ActivityLog]),
  ],
  providers: [SuperAdminService],
  exports: [SuperAdminService, TypeOrmModule],
})
export class DatabaseModule {}