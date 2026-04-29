import { Module } from '@nestjs/common';
import { AppStorageService } from './app-storage.service';

@Module({
  providers: [AppStorageService],
  exports: [AppStorageService],
})
export class StorageModule {}