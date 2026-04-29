import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BloodDonation } from './entities/blood-donation.entity';
import { BloodRequest } from './entities/blood-request.entity';
import { Donor } from './entities/donor.entity';
import { SuperAdmin } from './entities/superadmin.entity';
import { SuperAdminService } from './superadmin.service';

@Module({
  imports: [TypeOrmModule.forFeature([SuperAdmin, Donor, BloodRequest, BloodDonation])],
  providers: [SuperAdminService],
  exports: [SuperAdminService, TypeOrmModule],
})
export class DatabaseModule {}