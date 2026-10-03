import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { SuperAdminRoleGuard } from '../shared/guards/superadmin-role.guard';
import { NearbyDonorsQueryDto } from './dto/nearby-donors-query.dto';
import { MapService } from './map.service';

@ApiTags('Map')
@ApiBearerAuth('jwt')
@Controller('map')
@UseGuards(JwtAuthGuard)
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
  @UseGuards(SuperAdminRoleGuard)
  @ApiOperation({ summary: 'Show combined map overview for donors and requests' })
  getOverview(@Query() query: NearbyDonorsQueryDto) {
    return this.mapService.getOverview(query);
  }
}