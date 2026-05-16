import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { BloodRequestsService } from './blood-requests.service';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { CompleteBloodRequestDto } from './dto/complete-blood-request.dto';
import { UpdateBloodRequestDto } from './dto/update-blood-request.dto';
import { ScheduleBloodRequestDto } from './dto/schedule-blood-request.dto';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';

@ApiTags('Blood Requests')
@ApiBearerAuth('jwt')
@Controller('blood-requests')
@UseGuards(JwtAuthGuard)
export class BloodRequestsController {
  constructor(private readonly bloodRequestsService: BloodRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a blood request' })
  @ApiBody({ type: CreateBloodRequestDto })
  create(@Request() req: any, @Body() createBloodRequestDto: CreateBloodRequestDto) {
    const userId = req.user?.sub;
    return this.bloodRequestsService.create(createBloodRequestDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all requests, urgent first' })
  findAll(@Request() req: any) {
    const userId = req.user?.sub;
    return this.bloodRequestsService.findAll(userId ? Number(userId) : undefined);
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'List all blood requests created by the authenticated user' })
  findMyRequests(@Request() req: any) {
    return this.bloodRequestsService.findMyRequests(Number(req.user.sub));
  }

  @Get('my-scheduled-requests')
  @ApiOperation({ summary: 'List all scheduled blood requests created by the authenticated user' })
  findMyScheduledRequests(@Request() req: any) {
    return this.bloodRequestsService.findMyScheduledRequests(Number(req.user.sub));
  }

  @Get('active')
  @ApiOperation({ summary: 'List active requests' })
  findActive() {
    return this.bloodRequestsService.findActive();
  }

  @Get('urgent')
  @ApiOperation({ summary: 'List urgent active requests' })
  findUrgent() {
    return this.bloodRequestsService.findUrgent();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get blood request by ID' })
  findOne(@Param('id') id: string) {
    return this.bloodRequestsService.findOne(Number(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update blood request' })
  @ApiBody({ type: UpdateBloodRequestDto })
  update(@Param('id') id: string, @Body() updateBloodRequestDto: UpdateBloodRequestDto) {
    return this.bloodRequestsService.update(Number(id), updateBloodRequestDto);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark request as completed and attach donor' })
  @ApiBody({ type: CompleteBloodRequestDto })
  complete(@Param('id') id: string, @Body() body: CompleteBloodRequestDto) {
    return this.bloodRequestsService.complete(Number(id), Number(body.donorId));
  }

  @Get(':id/match')
  @ApiOperation({ summary: "Check if this blood request matches authenticated user's available donors" })
  matchToMyDonor(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub;
    return this.bloodRequestsService.matchToUserDonor(Number(id), Number(userId));
  }

  @Post(':id/request')
  @ApiOperation({ summary: 'Request an available donor for this blood request' })
  requestAnyAvailableDonor(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub;
    return this.bloodRequestsService.requestAnyAvailableDonor(Number(id), Number(userId));
  }

  @Post('schedule')
  @ApiOperation({ summary: 'Schedule a donation using requestId and scheduleDate from request body' })
  @ApiBody({ type: ScheduleBloodRequestDto })
  schedule(@Request() req: any, @Body() dto: ScheduleBloodRequestDto) {
    const userId = req.user?.sub;
    const scheduleDate = new Date(dto.scheduleDate);
    return this.bloodRequestsService.scheduleBloodRequest(Number(dto.requestId), Number(userId), scheduleDate);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete blood request' })
  remove(@Param('id') id: string) {
    return this.bloodRequestsService.remove(Number(id));
  }
}
