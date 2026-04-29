import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { DonorAuthController } from './donor-auth.controller';
import { DonorAuthService } from './donor-auth.service';

@Module({
  imports: [StorageModule],
  controllers: [DonorAuthController],
  providers: [DonorAuthService],
})
export class DonorAuthModule {}