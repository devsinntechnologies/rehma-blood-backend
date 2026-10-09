import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { DonorCompleteDto } from './dto/donor-complete.dto';
import { ConfirmReceiptDto } from './dto/confirm-receipt.dto';

import { BloodRequestsService } from './blood-requests.service';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { CompleteBloodRequestDto } from './dto/complete-blood-request.dto';
import { UpdateBloodRequestDto } from './dto/update-blood-request.dto';
import { ScheduleBloodRequestDto } from './dto/schedule-blood-request.dto';
import { RequestDonorDto } from './dto/request-donor.dto';
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
    // Superadmin sees every request; other roles don't see their own requests in the feed.
    const userId = req.user?.role === 'superadmin' ? undefined : req.user?.sub;
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
  update(@Param('id') id: string, @Request() req: any, @Body() updateBloodRequestDto: UpdateBloodRequestDto) {
    return this.bloodRequestsService.update(Number(id), updateBloodRequestDto, req.user?.role);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark request as completed and attach donor' })
  @ApiBody({ type: CompleteBloodRequestDto })
  complete(
    @Param('id') id: string,
    @Request() req: any,
    @Body() _body: CompleteBloodRequestDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    // The body's donorId is accepted for older app versions but ignored: the
    // donation is credited to the donor who accepted the request.
    return this.bloodRequestsService.complete(
      Number(id),
      Number(req.user?.sub),
      req.user?.role,
      idempotencyKey,
    );
  }

  @Patch(':id/donor-complete')
  @ApiOperation({ summary: 'Donor marks donation as completed' })
  @ApiBody({ type: DonorCompleteDto })
  donorComplete(@Param('id') id: string, @Request() req: any, @Body() _dto: DonorCompleteDto) {
    return this.bloodRequestsService.complete(Number(id), Number(req.user?.sub), req.user?.role);
  }

  @Post(':id/confirm-receipt')
  @ApiOperation({ summary: 'Requester confirms receipt of blood' })
  @ApiBody({ type: ConfirmReceiptDto })
  confirmReceipt(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: ConfirmReceiptDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const requesterId = Number(req.user?.sub);
    return this.bloodRequestsService.confirmReceipt(
      Number(id),
      dto.received,
      requesterId,
      dto.unitsReceived,
      dto.participationId,
      idempotencyKey,
    );
  }

  @Get(':id/match')
  @ApiOperation({ summary: "Check if this blood request matches authenticated user's available donors" })
  matchToMyDonor(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub;
    return this.bloodRequestsService.matchToUserDonor(Number(id), Number(userId));
  }

  @Post(':id/request')
  @ApiOperation({ summary: 'Request an available donor for this blood request' })
  @ApiBody({ type: RequestDonorDto, required: false })
  requestAnyAvailableDonor(@Param('id') id: string, @Request() req: any, @Body() dto: RequestDonorDto) {
    const userId = req.user?.sub;
    return this.bloodRequestsService.requestAnyAvailableDonor(Number(id), Number(userId), dto?.donorId);
  }

  @Post('schedule')
  @ApiOperation({ summary: 'Schedule a donation using requestId and scheduleDate from request body' })
  @ApiBody({ type: ScheduleBloodRequestDto })
  schedule(
    @Request() req: any,
    @Body() dto: ScheduleBloodRequestDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const userId = req.user?.sub;
    const scheduleDate = new Date(dto.scheduleDate);
    return this.bloodRequestsService.scheduleBloodRequest(
      Number(dto.requestId),
      Number(userId),
      scheduleDate,
      idempotencyKey,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete blood request' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.bloodRequestsService.remove(Number(id), Number(req.user?.sub), req.user?.role);
  }
}
