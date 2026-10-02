import { Module } from '@nestjs/common';
import { AppStorageService } from './app-storage.service';
import { StoragePersistenceService } from './storage-persistence.service';
import { PersistenceInterceptor } from './persistence.interceptor';

@Module({
  providers: [AppStorageService, StoragePersistenceService, PersistenceInterceptor],
  exports: [AppStorageService, StoragePersistenceService, PersistenceInterceptor],
})
export class StorageModule {}
