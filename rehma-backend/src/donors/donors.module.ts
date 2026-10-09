import { Module } from '@nestjs/common';
import { DonorsController } from './donors.controller';
import { DonorsService } from './donors.service';
import { StorageModule } from '../storage/storage.module';
import { BloodRequestsModule } from '../blood-requests/blood-requests.module';

@Module({
  imports: [StorageModule, BloodRequestsModule],
  controllers: [DonorsController],
  providers: [DonorsService],
  exports: [DonorsService],
})
export class DonorsModule {}
