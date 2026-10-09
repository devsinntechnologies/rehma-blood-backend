import { Body, Controller, Get, Headers, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { ParticipationLifecycleService } from './participation-lifecycle.service';

@ApiTags('Participations')
@ApiBearerAuth('jwt')
@Controller()
@UseGuards(JwtAuthGuard)
export class ParticipationsController {
  constructor(private readonly lifecycle: ParticipationLifecycleService) {}

  private actor(req: any) {
    return { userId: Number(req.user.sub), role: req.user.role as 'user' | 'superadmin' };
  }

  @Get('blood-requests/:id/tracking')
  getTracking(@Param('id') id: string, @Request() req: any) {
    return this.lifecycle.getTracking(Number(id), this.actor(req));
  }

  @Get('blood-requests/:id/participation-audit')
  getAudit(@Param('id') id: string, @Request() req: any) {
    return this.lifecycle.getParticipationAudit(Number(id), this.actor(req));
  }

  @Post('blood-requests/:id/cancel')
  cancel(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.lifecycle.cancelRequest(Number(id), this.actor(req), body.reason ?? 'cancelled', idempotencyKey);
  }

  @Patch('participations/:id/respond')
  respond(
    @Param('id') id: string,
    @Request() req: any,
    @Body()
    body: {
      response: 'can_help' | 'cannot_help' | 'available_later';
      unitsCommitted?: number;
      agreedAt?: string;
      offeredAt?: string;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.lifecycle.respond(Number(id), this.actor(req), body, idempotencyKey);
  }

  @Post('participations/:id/report-donation')
  report(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { unitsReported: number },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.lifecycle.reportDonation(Number(id), this.actor(req), body.unitsReported ?? 1, idempotencyKey);
  }

  @Post('participations/:id/confirm-receipt')
  confirm(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { unitsReceived: number },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.lifecycle.confirmReceipt(Number(id), this.actor(req), body.unitsReceived ?? 1, idempotencyKey);
  }

  @Post('participations/:id/dispute')
  dispute(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.lifecycle.dispute(Number(id), this.actor(req), body.reason, idempotencyKey);
  }

  @Post('participations/:id/withdraw')
  withdraw(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.lifecycle.withdrawParticipation(Number(id), this.actor(req), body.reason ?? 'withdrawn', idempotencyKey);
  }

  @Post('admin/participations/:id/reconcile-legacy')
  reconcileLegacy(
    @Param('id') id: string,
    @Request() req: any,
    @Body()
    body: { unitsReported?: number; unitsConfirmed: number; reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.lifecycle.adminReconcileLegacy(Number(id), this.actor(req), body, idempotencyKey);
  }

  @Post('admin/participations/:id/resolve-dispute')
  resolveDispute(
    @Param('id') id: string,
    @Request() req: any,
    @Body()
    body: { outcome: 'confirm_units' | 'reject_report'; unitsConfirmed?: number; reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.lifecycle.adminResolveDispute(Number(id), this.actor(req), body, idempotencyKey);
  }
}
