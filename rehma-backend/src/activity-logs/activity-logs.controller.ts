import { Controller, Get, Post, Param, Query, UseGuards, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ActivityLogsService, FilterActivityLogsDto } from './activity-logs.service';
import { SuperAdminRoleGuard } from '../shared/guards/superadmin-role.guard';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';

@ApiTags('Activity Logs')
@ApiBearerAuth('jwt')
@Controller('activity-logs')
@UseGuards(JwtAuthGuard, SuperAdminRoleGuard)
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all activity logs (Super Admin only)' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'method', required: false, type: String, description: 'HTTP method (GET, POST, etc.)' })
  @ApiQuery({ name: 'endpoint', required: false, type: String, description: 'API endpoint' })
  @ApiQuery({ name: 'statusCode', required: false, type: Number, description: 'HTTP status code' })
  @ApiQuery({ name: 'userEmail', required: false, type: String, description: 'User email' })
  @ApiQuery({ name: 'userRole', required: false, type: String, description: 'User role' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 50)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  async findAll(@Query() query: any) {
    const filters: FilterActivityLogsDto = {
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      method: query.method,
      endpoint: query.endpoint,
      statusCode: query.statusCode ? parseInt(query.statusCode) : undefined,
      userEmail: query.userEmail,
      userRole: query.userRole,
      limit: query.limit ? parseInt(query.limit) : 50,
      page: query.page ? parseInt(query.page) : 1,
    };

    return this.activityLogsService.findAll(filters);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get activity logs statistics (Super Admin only)' })
  async getStatistics() {
    return this.activityLogsService.getStatistics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get activity log by ID (Super Admin only)' })
  async findOne(@Param('id') id: string) {
    return this.activityLogsService.findOne(Number(id));
  }

  @Get('user/:userEmail')
  @ApiOperation({ summary: 'Get activity logs by user email (Super Admin only)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 50)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  async findByUserEmail(@Param('userEmail') userEmail: string, @Query() query: any) {
    const limit = query.limit ? parseInt(query.limit) : 50;
    const page = query.page ? parseInt(query.page) : 1;
    return this.activityLogsService.findByUserEmail(userEmail, limit, page);
  }

  @Get('endpoint/:endpoint')
  @ApiOperation({ summary: 'Get activity logs by endpoint (Super Admin only)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 50)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  async findByEndpoint(@Param('endpoint') endpoint: string, @Query() query: any) {
    const limit = query.limit ? parseInt(query.limit) : 50;
    const page = query.page ? parseInt(query.page) : 1;
    return this.activityLogsService.findByEndpoint(decodeURIComponent(endpoint), limit, page);
  }
}
