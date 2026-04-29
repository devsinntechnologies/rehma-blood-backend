import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';

@ApiTags('Superadmin Dashboard')
@ApiBearerAuth('jwt')
@Controller('superadmin')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get superadmin dashboard stats' })
  getStats() {
    return this.dashboardService.getStats();
  }
}