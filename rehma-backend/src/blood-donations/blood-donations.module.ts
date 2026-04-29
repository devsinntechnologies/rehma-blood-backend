import { Module } from '@nestjs/common';
import { BloodDonationsController } from './blood-donations.controller';
import { BloodDonationsService } from './blood-donations.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [BloodDonationsController],
  providers: [BloodDonationsService],
  exports: [BloodDonationsService],
})
export class BloodDonationsModule {}
