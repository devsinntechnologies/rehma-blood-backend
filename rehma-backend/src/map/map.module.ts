import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { MapController } from './map.controller';
import { MapService } from './map.service';

@Module({
  imports: [StorageModule],
  controllers: [MapController],
  providers: [MapService],
})
export class MapModule {}