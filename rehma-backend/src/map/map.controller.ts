import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NearbyDonorsQueryDto } from './dto/nearby-donors-query.dto';
import { MapService } from './map.service';

@ApiTags('Map')
@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('nearby-donors')
  @ApiOperation({ summary: 'Show nearby relevant donor markers' })
  getNearbyDonors(@Query() query: NearbyDonorsQueryDto) {
    return this.mapService.getNearbyDonors(query);
  }

  @Get('active-requests')
  @ApiOperation({ summary: 'Show active blood request markers' })
  getActiveRequests() {
    return this.mapService.getActiveRequests();
  }

  @Get('overview')
  @ApiOperation({ summary: 'Show combined map overview for donors and requests' })
  getOverview(@Query() query: NearbyDonorsQueryDto) {
    return this.mapService.getOverview(query);
  }
}