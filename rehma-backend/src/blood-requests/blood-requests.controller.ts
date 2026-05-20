import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { DonorCompleteDto } from './dto/donor-complete.dto';
import { ConfirmReceiptDto } from './dto/confirm-receipt.dto';

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
  constructor(private readonly bloodRequestsService: BloodRequestsService) { }

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

  @Get('scheduled-donations')
  @ApiOperation({ summary: 'List all scheduled donations with requester and donor details (any status)' })
  findAllScheduledDonations() {
    return this.bloodRequestsService.findAllScheduledDonations();
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

  @Patch(':id/donor-complete')
  @ApiOperation({ summary: 'Donor marks donation as completed' })
  @ApiBody({ type: DonorCompleteDto })
  donorComplete(@Param('id') id: string, @Request() req: any, @Body() dto: DonorCompleteDto) {
    const donorId = dto.donorId ?? Number(req.user?.sub);
    return this.bloodRequestsService.donorComplete(Number(id), donorId);
  }

  @Post(':id/confirm-receipt')
  @ApiOperation({ summary: 'Requester confirms receipt of blood' })
  @ApiBody({ type: ConfirmReceiptDto })
  confirmReceipt(@Param('id') id: string, @Request() req: any, @Body() dto: ConfirmReceiptDto) {
    const requesterId = Number(req.user?.sub);
    return this.bloodRequestsService.confirmReceipt(Number(id), dto.received, requesterId);
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
