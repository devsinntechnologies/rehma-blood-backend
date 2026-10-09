import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AppStorageService,
  BloodRequestRecord,
  RequestParticipationRecord,
} from '../storage/app-storage.service';
import {
  assertCommitmentWithinCapacity,
  summarizeRequestUnits,
} from './unit-accounting.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IdempotencyService } from '../shared/idempotency.service';
import { ParticipationInviteService } from './participation-invite.service';
import { PushDeliveryService } from '../notifications/push-delivery.service';

type Actor = { userId: number; role: 'user' | 'superadmin' };

@Injectable()
export class ParticipationLifecycleService {
  private readonly locks = new Map<number, Promise<void>>();

  constructor(
    private readonly storage: AppStorageService,
    private readonly notifications: NotificationsService,
    private readonly idempotency: IdempotencyService,
    @Optional()
    @Inject(forwardRef(() => ParticipationInviteService))
    private readonly inviteService: ParticipationInviteService | null,
    @Optional() private readonly pushDelivery: PushDeliveryService | null,
  ) {}

  private async withRequestLock<T>(requestId: number, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(requestId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(
      requestId,
      prev.then(() => gate),
    );
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  getTracking(requestId: number, actor: Actor) {
    const request = this.storage.getBloodRequest(requestId);
    if (!request) throw new NotFoundException('Blood request not found');
    this.assertCanViewRequest(request, actor);
    const participations = this.storage.listParticipationsForRequest(requestId);
    const summary = summarizeRequestUnits(request.requiredUnits, participations);
    return { request, summary, participations };
  }

  getParticipationAudit(requestId: number, actor: Actor) {
    const request = this.storage.getBloodRequest(requestId);
    if (!request) throw new NotFoundException('Blood request not found');
    if (actor.role !== 'superadmin') {
      this.assertCanViewRequest(request, actor);
    }
    return {
      requestId,
      audits: this.storage.listParticipationAuditsForRequest(requestId),
    };
  }

  assertDonorOwner(participation: RequestParticipationRecord, actor: Actor): void {
    if (actor.role === 'superadmin') return;
    if (participation.ownerUserId !== actor.userId) {
      throw new ForbiddenException('You are not authorized to act on this donor participation');
    }
  }

  private assertCanViewRequest(request: BloodRequestRecord, actor: Actor): void {
    if (actor.role === 'superadmin') return;
    if (request.requesterUserId === actor.userId) return;
    const owned = this.storage.listParticipationsForRequest(request.id).some((p) => p.ownerUserId === actor.userId);
    if (!owned) throw new ForbiddenException('You cannot view this request');
  }

  async respond(
    participationId: number,
    actor: Actor,
    body: {
      response: 'can_help' | 'cannot_help' | 'available_later';
      unitsCommitted?: number;
      agreedAt?: string;
      offeredAt?: string;
    },
    idempotencyKey?: string,
  ) {
    return this.idempotency.run(
      {
        actorUserId: actor.userId,
        actorRole: actor.role,
        operation: `participation:respond:${participationId}`,
        clientKey: idempotencyKey,
        body,
      },
      async () => {
        const participationSeed = this.storage.getParticipation(participationId);
        if (!participationSeed) throw new NotFoundException('Participation not found');

        const data = await this.withRequestLock(participationSeed.requestId, async () => {
          const participation = this.storage.getParticipation(participationId);
          if (!participation) throw new NotFoundException('Participation not found');
          this.assertDonorOwner(participation, actor);

          const request = this.storage.getBloodRequest(participation.requestId);
          if (!request) throw new NotFoundException('Blood request not found');
          if (!this.storage.isRequestAcceptingNewCommitments(request)) {
            throw new ConflictException('This request is no longer accepting commitments');
          }

          if (body.response === 'cannot_help') {
            const updated = this.storage.updateParticipation(participation.id, {
              status: 'declined',
              responseType: 'cannot_help',
            });
            this.audit(participation, actor, 'declined', 'cannot_help', participation.status, 'declined');
            this.syncLegacyFromPrimary(request);
            this.releaseRequestIfNoActiveParticipations(request);
            const afterReassign = this.inviteService?.reassignAfterSlotReleased(request.id);
            return { participation: updated, request: afterReassign ?? request };
          }

          if (body.response === 'available_later') {
            const offeredAt = body.offeredAt ? new Date(body.offeredAt) : null;
            if (offeredAt && request.deadlineAt && offeredAt > new Date(request.deadlineAt)) {
              throw new BadRequestException(
                'Offered time is after the request deadline. Search will continue without reserving this slot.',
              );
            }
            const updated = this.storage.updateParticipation(participation.id, {
              status: 'available_later',
              responseType: 'available_later',
              offeredAt,
            });
            this.audit(participation, actor, 'available_later', null, participation.status, 'available_later');
            return { participation: updated, request };
          }

          const units = Math.max(1, body.unitsCommitted ?? 1);
          const participations = this.storage.listParticipationsForRequest(request.id);
          const summary = summarizeRequestUnits(request.requiredUnits, participations);
          assertCommitmentWithinCapacity(summary, units);

          const agreedAt = body.agreedAt ? new Date(body.agreedAt) : new Date();
          if (request.deadlineAt && agreedAt > new Date(request.deadlineAt)) {
            throw new BadRequestException('Agreed time cannot be after the request deadline');
          }

          const updated = this.storage.updateParticipation(
            participation.id,
            {
              status: 'accepted',
              responseType: 'can_help',
              unitsCommitted: units,
              agreedAt,
            },
            participation.version,
          );
          if (!updated) throw new ConflictException('Participation was updated by another request; please retry');

          this.audit(participation, actor, 'accepted', null, participation.status, 'accepted');
          this.syncLegacyFromPrimary(request);
          await this.notifyAfterChange(request, updated!, actor, 'blood_request_updated', idempotencyKey);
          return { participation: updated, request };
        });
        return { statusCode: 200, body: data as unknown as Record<string, unknown> };
      },
    );
  }

  async cancelRequest(
    requestId: number,
    actor: Actor,
    reason: string,
    idempotencyKey?: string,
  ) {
    return this.idempotency.run(
      {
        actorUserId: actor.userId,
        actorRole: actor.role,
        operation: `request:cancel:${requestId}`,
        clientKey: idempotencyKey,
        body: { reason },
      },
      async () => {
        const result = await this.withRequestLock(requestId, async () => {
          const request = this.storage.getBloodRequest(requestId);
          if (!request) throw new NotFoundException('Blood request not found');
          if (actor.role !== 'superadmin' && request.requesterUserId !== actor.userId) {
            throw new ForbiddenException('Only the requester or admin can cancel this request');
          }

          const terminal = new Set([
            'receipt_confirmed',
            'resolved_confirmed',
            'resolved_rejected',
            'disputed',
            'reported',
            'partially_confirmed',
          ]);
          for (const p of this.storage.listParticipationsForRequest(requestId)) {
            if (terminal.has(p.status)) continue;
            if (['invited', 'available_later', 'accepted', 'scheduled'].includes(p.status)) {
              this.storage.updateParticipation(p.id, { status: 'cancelled' });
            }
          }

          this.storage.updateBloodRequest(requestId, {
            status: 'cancelled',
            matchingStopped: true,
            cancelReason: reason,
            cancelledAt: new Date(),
          });
          this.storage.addParticipationAudit({
            participationId: null,
            requestId,
            actorUserId: actor.userId,
            actorRole: actor.role,
            action: 'cancel_request',
            reason,
            fromStatus: request.status,
            toStatus: 'cancelled',
            metadata: null,
          });
          return this.storage.getBloodRequest(requestId);
        });
        return { statusCode: 200, body: { request: result } as unknown as Record<string, unknown> };
      },
    );
  }

  async reportDonation(
    participationId: number,
    actor: Actor,
    unitsReported: number,
    idempotencyKey?: string,
  ) {
    return this.idempotency.run(
      {
        actorUserId: actor.userId,
        actorRole: actor.role,
        operation: `participation:report:${participationId}`,
        clientKey: idempotencyKey,
        body: { unitsReported },
      },
      async () => {
        const seed = this.storage.getParticipation(participationId);
        if (!seed) throw new NotFoundException('Participation not found');

        const body = await this.withRequestLock(seed.requestId, async () => {
          const participation = this.storage.getParticipation(participationId);
          if (!participation) throw new NotFoundException('Participation not found');
          this.assertDonorOwner(participation, actor);
          if (!['accepted', 'scheduled'].includes(participation.status)) {
            throw new ConflictException('Only an accepted commitment can be reported');
          }
          const units = Math.max(1, unitsReported);
          if (units > participation.unitsCommitted) {
            throw new BadRequestException('Reported units cannot exceed committed units');
          }

          const partial = units < participation.unitsCommitted;
          const nextStatus = partial ? participation.status : 'reported';
          const updated = this.storage.updateParticipation(participation.id, {
            status: nextStatus,
            unitsReported: units,
            reportedAt: new Date(),
          });

          const request = this.storage.getBloodRequest(participation.requestId)!;
          this.applyLegacyRequestStatusAfterReport(request, updated!, partial);
          this.recordDonorCooldown(participation.donorId);
          this.syncLegacyFromPrimary(request);
          this.storage.upsertBloodDonationForRequest({
            requestId: request.id,
            donorId: participation.donorId,
            donorName: this.storage.getDonor(participation.donorId)?.fullName ?? '',
            bloodGroup: request.bloodGroup,
            status: partial ? 'donation_pending' : 'completed',
          });
          await this.notifyAfterChange(
            request,
            updated!,
            actor,
            partial ? 'blood_request_updated' : 'blood_request_completed',
            idempotencyKey,
          );
          return { participation: updated, request };
        });
        return { statusCode: 200, body: body as unknown as Record<string, unknown> };
      },
    );
  }

  async confirmReceipt(
    participationId: number,
    actor: Actor,
    unitsReceived: number,
    idempotencyKey?: string,
  ) {
    return this.idempotency.run(
      {
        actorUserId: actor.userId,
        actorRole: actor.role,
        operation: `participation:confirm:${participationId}`,
        clientKey: idempotencyKey,
        body: { unitsReceived },
      },
      async () => {
        const seed = this.storage.getParticipation(participationId);
        if (!seed) throw new NotFoundException('Participation not found');

        const body = await this.withRequestLock(seed.requestId, async () => {
          const participation = this.storage.getParticipation(participationId);
          if (!participation) throw new NotFoundException('Participation not found');
          const request = this.storage.getBloodRequest(participation.requestId);
          if (!request) throw new NotFoundException('Blood request not found');
          if (actor.role !== 'superadmin' && request.requesterUserId !== actor.userId) {
            throw new ForbiddenException('Only the requester can confirm receipt');
          }
          if (!['reported', 'partially_confirmed'].includes(participation.status)) {
            throw new ConflictException('Donation has not been reported yet');
          }

          const units = Math.max(1, unitsReceived);
          if (participation.unitsConfirmed + units > participation.unitsReported) {
            throw new BadRequestException(
              'Cumulative confirmed units cannot exceed reported units for this participation',
            );
          }
          const unresolved = Math.max(0, participation.unitsReported - participation.unitsConfirmed - units);

          const nextStatus =
            unresolved > 0 ? 'partially_confirmed' : 'receipt_confirmed';
          const updated = this.storage.updateParticipation(participation.id, {
            status: nextStatus,
            unitsConfirmed: participation.unitsConfirmed + units,
            receiptConfirmedAt: new Date(),
            quantityConfidence: 'exact',
            needsAdminReconciliation: false,
          });

          const summary = summarizeRequestUnits(
            request.requiredUnits,
            this.storage.listParticipationsForRequest(request.id),
          );
          if (summary.remainingNeed === 0) {
            this.storage.updateBloodRequest(request.id, {
              received: true,
              receivedAt: new Date(),
              matchingStopped: true,
              status: 'donation_completed',
            });
          } else {
            this.storage.updateBloodRequest(request.id, { matchingStopped: false });
          }
          return { participation: updated, request, summary };
        });
        return { statusCode: 200, body: body as unknown as Record<string, unknown> };
      },
    );
  }

  async dispute(
    participationId: number,
    actor: Actor,
    reason: string,
    idempotencyKey?: string,
  ) {
    return this.idempotency.run(
      {
        actorUserId: actor.userId,
        actorRole: actor.role,
        operation: `participation:dispute:${participationId}`,
        clientKey: idempotencyKey,
        body: { reason },
      },
      async () => {
        const seed = this.storage.getParticipation(participationId);
        if (!seed) throw new NotFoundException('Participation not found');

        const body = await this.withRequestLock(seed.requestId, async () => {
          const participation = this.storage.getParticipation(participationId);
          if (!participation) throw new NotFoundException('Participation not found');
          const request = this.storage.getBloodRequest(participation.requestId);
          if (!request) throw new NotFoundException('Blood request not found');
          if (actor.role !== 'superadmin' && request.requesterUserId !== actor.userId) {
            throw new ForbiddenException('Only the requester can dispute receipt');
          }
          if (!['reported', 'partially_confirmed'].includes(participation.status)) {
            throw new ConflictException('Dispute is only available after a donation report');
          }

          const updated = this.storage.updateParticipation(participation.id, {
            status: 'disputed',
            disputeReason: reason,
          });
          this.audit(participation, actor, 'dispute', reason, participation.status, 'disputed');
          return { participation: updated, request };
        });
        return { statusCode: 200, body: body as unknown as Record<string, unknown> };
      },
    );
  }

  async adminResolveDispute(
    participationId: number,
    actor: Actor,
    input: { outcome: 'confirm_units' | 'reject_report'; unitsConfirmed?: number; reason: string },
    idempotencyKey?: string,
  ) {
    if (actor.role !== 'superadmin') throw new ForbiddenException('Admin only');
    return this.idempotency.run(
      {
        actorUserId: actor.userId,
        actorRole: actor.role,
        operation: `participation:resolve:${participationId}`,
        clientKey: idempotencyKey,
        body: input,
      },
      async () => {
        const seed = this.storage.getParticipation(participationId);
        if (!seed) throw new NotFoundException('Participation not found');

        const body = await this.withRequestLock(seed.requestId, async () => {
          const participation = this.storage.getParticipation(participationId);
          if (!participation) throw new NotFoundException('Participation not found');
          if (participation.status !== 'disputed') {
            throw new ConflictException('Participation is not disputed');
          }
          const request = this.storage.getBloodRequest(participation.requestId)!;

          if (input.outcome === 'reject_report') {
            const updated = this.storage.updateParticipation(participation.id, {
              status: 'resolved_rejected',
              unitsReported: 0,
              unitsCommitted: 0,
            });
            this.audit(participation, actor, 'resolve_dispute_reject', input.reason, 'disputed', 'resolved_rejected');
            return { participation: updated, request };
          }

          const units = Math.max(1, input.unitsConfirmed ?? 1);
          const updated = this.storage.updateParticipation(participation.id, {
            status: 'resolved_confirmed',
            unitsConfirmed: participation.unitsConfirmed + units,
            quantityConfidence: 'admin_reconciled',
            needsAdminReconciliation: false,
          });
          this.audit(participation, actor, 'resolve_dispute_confirm', input.reason, 'disputed', 'resolved_confirmed');
          return { participation: updated, request };
        });
        return { statusCode: 200, body: body as unknown as Record<string, unknown> };
      },
    );
  }

  transferOwnershipForDonorClaim(donorId: number, newOwnerUserId: number, previousOwnerUserId?: number): number {
    return this.storage.transferParticipationOwnershipForDonor(donorId, newOwnerUserId, previousOwnerUserId);
  }

  /** Marks past-due invitations expired and reopens matching when no active participations remain. */
  async processExpiredInvites(): Promise<number> {
    const expired = this.storage.listInvitedParticipationsPastExpiry();
    let count = 0;
    for (const seed of expired) {
      await this.withRequestLock(seed.requestId, async () => {
        const participation = this.storage.getParticipation(seed.id);
        if (!participation || participation.status !== 'invited') return;
        if (
          participation.inviteExpiresAt == null ||
          new Date(participation.inviteExpiresAt).getTime() > Date.now()
        ) {
          return;
        }
        const request = this.storage.getBloodRequest(participation.requestId);
        if (!request) return;

        this.storage.updateParticipation(participation.id, { status: 'expired' });
        this.audit(participation, { userId: 0, role: 'superadmin' }, 'invite_expired', 'timeout', 'invited', 'expired');
        this.syncLegacyFromPrimary(request);
        this.releaseRequestIfNoActiveParticipations(request);
        this.inviteService?.reassignAfterSlotReleased(request.id);
        count += 1;

        if (request.requesterUserId != null) {
          this.notifications.create({
            recipient: { role: 'user', userId: request.requesterUserId },
            type: 'blood_request_updated',
            title: 'Donor invitation expired',
            message: `The invitation for blood request #${request.id} timed out. You can send the request to another donor.`,
            entityType: 'blood_request',
            entityId: request.id,
            metadata: { deepLink: `rehma://request/${request.id}` },
          });
        }
      });
    }
    return count;
  }

  private releaseRequestIfNoActiveParticipations(request: BloodRequestRecord): void {
    if (request.matchingStopped || request.status === 'cancelled') return;
    const active = new Set([
      'invited',
      'available_later',
      'accepted',
      'scheduled',
      'reported',
      'partially_confirmed',
      'disputed',
    ]);
    const hasActive = this.storage.listParticipationsForRequest(request.id).some((p) => active.has(p.status));
    if (hasActive) return;
    if (request.status !== 'request_pending') return;
    this.storage.updateBloodRequest(request.id, {
      status: 'active',
      requestedToDonorId: null,
      requestedToDonorName: null,
      acceptedByDonorId: null,
      acceptedByDonorName: null,
      acceptedAt: null,
    });
  }

  createInviteParticipation(
    request: BloodRequestRecord,
    donorId: number,
    ownerUserId: number,
    inviteExpiresAt: Date,
  ): RequestParticipationRecord {
    return this.storage.addParticipation({
      requestId: request.id,
      donorId,
      ownerUserId,
      historicalOwnerUserId: null,
      status: 'invited',
      responseType: null,
      unitsCommitted: 0,
      unitsReported: 0,
      unitsConfirmed: 0,
      legacyMigrated: false,
      needsAdminReconciliation: false,
      quantityConfidence: 'exact',
      offeredAt: null,
      agreedAt: null,
      inviteExpiresAt,
      reportedAt: null,
      receiptConfirmedAt: null,
      disputeReason: null,
      lastEventId: null,
    });
  }

  async scheduleForVolunteerDonor(
    requestId: number,
    userId: number,
    scheduleDate: Date,
    idempotencyKey?: string,
  ) {
    return this.idempotency.run(
      {
        actorUserId: userId,
        actorRole: 'user',
        operation: `request:schedule:${requestId}`,
        clientKey: idempotencyKey,
        body: { scheduleDate: scheduleDate.toISOString() },
      },
      async () => {
        const body = await this.withRequestLock(requestId, async () => {
          const request = this.storage.getBloodRequest(requestId);
          if (!request) throw new NotFoundException('Blood request not found');
          if (request.requesterUserId === userId) {
            throw new ForbiddenException("You can't donate to your own blood request");
          }
          if (!this.storage.isRequestAcceptingNewCommitments(request)) {
            throw new ConflictException('This request is not accepting new commitments');
          }
          if (request.status !== 'active' && request.status !== 'request_pending') {
            throw new ConflictException('Only active or pending blood requests can be scheduled');
          }

          const donor = this.pickEligibleDonorForUser(userId, request);
          if (!donor) {
            throw new ForbiddenException('No available donor matching the blood request');
          }

          let participation = this.storage
            .listParticipationsForRequest(requestId)
            .find(
              (p) =>
                p.donorId === donor.id &&
                ['invited', 'available_later', 'accepted', 'scheduled'].includes(p.status),
            );

          const units = 1;
          if (!participation) {
            const ownerUserId = this.storage.getDonorOwnerUserId(donor) ?? userId;
            const windowMs = request.urgency === 'urgent' ? 45 * 60_000 : 4 * 60 * 60_000;
            participation = this.createInviteParticipation(
              request,
              donor.id,
              ownerUserId,
              new Date(Date.now() + windowMs),
            );
            const summary = summarizeRequestUnits(
              request.requiredUnits,
              this.storage.listParticipationsForRequest(requestId),
            );
            assertCommitmentWithinCapacity(summary, units);
            participation =
              this.storage.updateParticipation(participation.id, {
                status: 'accepted',
                responseType: 'can_help',
                unitsCommitted: units,
                agreedAt: new Date(),
              }) ?? participation;
          } else if (participation.status === 'invited' || participation.status === 'available_later') {
            const summary = summarizeRequestUnits(
              request.requiredUnits,
              this.storage.listParticipationsForRequest(requestId),
            );
            assertCommitmentWithinCapacity(summary, units);
            participation =
              this.storage.updateParticipation(participation.id, {
                status: 'accepted',
                responseType: 'can_help',
                unitsCommitted: units,
                agreedAt: new Date(),
              }) ?? participation;
          }

          this.assertDonorOwner(participation, { userId, role: 'user' });

          const updated = this.storage.updateParticipation(participation.id, {
            status: 'scheduled',
            agreedAt: scheduleDate,
          });

          const bloodRequest = this.storage.updateBloodRequest(requestId, {
            status: 'accepted',
            scheduledDate: scheduleDate,
            acceptedByDonorId: donor.id,
            acceptedByDonorName: donor.fullName,
            acceptedAt: new Date(),
            requestedToDonorId: donor.id,
            requestedToDonorName: donor.fullName,
          })!;

          this.storage.upsertBloodDonationForRequest({
            requestId,
            donorId: donor.id,
            donorName: donor.fullName,
            bloodGroup: bloodRequest.bloodGroup,
            status: 'donation_pending',
          });

          await this.notifyAfterChange(bloodRequest, updated!, { userId, role: 'user' }, 'blood_request_updated', idempotencyKey);
          return { participation: updated, bloodRequest, donor };
        });
        return { statusCode: 200, body: body as unknown as Record<string, unknown> };
      },
    );
  }

  async withdrawParticipation(participationId: number, actor: Actor, reason: string, idempotencyKey?: string) {
    return this.idempotency.run(
      {
        actorUserId: actor.userId,
        actorRole: actor.role,
        operation: `participation:withdraw:${participationId}`,
        clientKey: idempotencyKey,
        body: { reason },
      },
      async () => {
        const seed = this.storage.getParticipation(participationId);
        if (!seed) throw new NotFoundException('Participation not found');

        const body = await this.withRequestLock(seed.requestId, async () => {
          const participation = this.storage.getParticipation(participationId);
          if (!participation) throw new NotFoundException('Participation not found');
          this.assertDonorOwner(participation, actor);
          if (!['accepted', 'scheduled'].includes(participation.status)) {
            throw new ConflictException('Only an active commitment can be withdrawn');
          }
          if (participation.unitsReported > 0) {
            throw new ConflictException('Cannot withdraw after reporting a donation');
          }

          const updated = this.storage.updateParticipation(participation.id, {
            status: 'withdrawn',
            unitsCommitted: 0,
          });
          this.audit(participation, actor, 'withdraw', reason, participation.status, 'withdrawn');

          const request = this.storage.getBloodRequest(participation.requestId)!;
          this.syncLegacyFromPrimary(request);
          this.releaseRequestIfNoActiveParticipations(request);
          this.inviteService?.reassignAfterSlotReleased(request.id);
          return { participation: updated, request };
        });
        return { statusCode: 200, body: body as unknown as Record<string, unknown> };
      },
    );
  }

  async adminReconcileLegacy(
    participationId: number,
    actor: Actor,
    input: { unitsReported?: number; unitsConfirmed: number; reason: string },
    idempotencyKey?: string,
  ) {
    if (actor.role !== 'superadmin') throw new ForbiddenException('Admin only');
    return this.idempotency.run(
      {
        actorUserId: actor.userId,
        actorRole: actor.role,
        operation: `participation:reconcile-legacy:${participationId}`,
        clientKey: idempotencyKey,
        body: input,
      },
      async () => {
        const seed = this.storage.getParticipation(participationId);
        if (!seed) throw new NotFoundException('Participation not found');

        const body = await this.withRequestLock(seed.requestId, async () => {
          const participation = this.storage.getParticipation(participationId);
          if (!participation) throw new NotFoundException('Participation not found');
          if (!participation.legacyMigrated && participation.quantityConfidence !== 'unknown_legacy') {
            throw new ConflictException('Participation is not awaiting legacy reconciliation');
          }
          if (!participation.needsAdminReconciliation) {
            throw new ConflictException('Participation has already been reconciled');
          }

          const request = this.storage.getBloodRequest(participation.requestId)!;
          const unitsReported = Math.max(0, input.unitsReported ?? 0);
          const unitsConfirmed = Math.max(0, input.unitsConfirmed);
          if (unitsConfirmed > request.requiredUnits) {
            throw new BadRequestException('Confirmed units cannot exceed required units on the request');
          }

          const status =
            unitsConfirmed >= unitsReported && unitsReported > 0
              ? unitsConfirmed < request.requiredUnits
                ? 'partially_confirmed'
                : 'receipt_confirmed'
              : 'reported';

          const updated = this.storage.updateParticipation(participation.id, {
            unitsReported,
            unitsConfirmed,
            status,
            needsAdminReconciliation: false,
            quantityConfidence: 'admin_reconciled',
          });
          this.audit(participation, actor, 'reconcile_legacy', input.reason, participation.status, status);

          const summary = summarizeRequestUnits(
            request.requiredUnits,
            this.storage.listParticipationsForRequest(request.id),
          );
          if (summary.remainingNeed === 0) {
            this.storage.updateBloodRequest(request.id, {
              received: true,
              receivedAt: new Date(),
              matchingStopped: true,
              status: 'donation_completed',
            });
          }
          return { participation: updated, request, summary };
        });
        return { statusCode: 200, body: body as unknown as Record<string, unknown> };
      },
    );
  }

  private pickEligibleDonorForUser(userId: number, request: BloodRequestRecord) {
    const donors = this.storage.listDonors().filter((d) => this.storage.getDonorOwnerUserId(d) === userId);
    const normalize = (s?: string | null) => (s ? s.replace(/\s+/g, '').toLowerCase() : '');
    const reqBg = normalize(request.bloodGroup);
    const eligible = donors.filter((d) => {
      const bg = normalize(d.bloodGroup);
      const availability = d.availabilityStatus ? String(d.availabilityStatus).toLowerCase() : '';
      return d.isActive && d.isAvailable && availability === 'available' && bg && bg === reqBg;
    });
    if (!eligible.length) return undefined;
    const isSelf = (d: (typeof eligible)[number]) => d.userId === userId || d.linkedUserId === userId;
    return eligible.find(isSelf) ?? eligible[0];
  }

  private applyLegacyRequestStatusAfterReport(
    request: BloodRequestRecord,
    participation: RequestParticipationRecord,
    partial: boolean,
  ): void {
    if (partial) {
      this.storage.updateBloodRequest(request.id, {
        status: 'request_accepted',
        completedAt: null,
      });
      return;
    }
    if (request.requiredUnits <= 1) {
      this.storage.updateBloodRequestStatus(request.id, 'donation_completed', participation.donorId);
      return;
    }
    this.storage.updateBloodRequest(request.id, {
      status: 'request_accepted',
      completedAt: new Date(),
    });
  }

  private recordDonorCooldown(donorId: number): void {
    const donor = this.storage.getDonor(donorId);
    if (!donor) return;
    donor.lastDonationDate = new Date().toISOString();
    donor.isAvailable = false;
    donor.availabilityStatus = 'Recently Donated';
    donor.updatedAt = new Date();
  }

  private syncLegacyFromPrimary(request: BloodRequestRecord): void {
    const participations = this.storage.listParticipationsForRequest(request.id);
    const primary =
      participations.find((p) => ['accepted', 'scheduled', 'reported', 'partially_confirmed'].includes(p.status)) ??
      participations.find((p) => p.status === 'invited');
    if (!primary) return;
    const donor = this.storage.getDonor(primary.donorId);
    request.acceptedByDonorId = primary.donorId;
    request.acceptedByDonorName = donor?.fullName ?? null;
    if (primary.status === 'invited') {
      request.status = 'request_pending';
      request.requestedToDonorId = primary.donorId;
    } else if (primary.status === 'accepted') {
      request.status = 'request_accepted';
    } else if (primary.status === 'scheduled') {
      request.status = 'accepted';
    }
    request.updatedAt = new Date();
  }

  private audit(
    participation: RequestParticipationRecord,
    actor: Actor,
    action: string,
    reason: string | null,
    fromStatus: string | null,
    toStatus: string | null,
  ): void {
    this.storage.addParticipationAudit({
      participationId: participation.id,
      requestId: participation.requestId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      reason,
      fromStatus,
      toStatus,
      metadata: { historicalOwnerUserId: participation.historicalOwnerUserId ?? null },
    });
  }

  private async notifyAfterChange(
    request: BloodRequestRecord,
    participation: RequestParticipationRecord,
    actor: Actor,
    type: 'blood_request_updated' | 'blood_request_completed',
    idempotencyKey?: string,
  ): Promise<void> {
    const eventId = randomUUID();
    this.storage.saveNotificationEvent({
      eventId,
      participationId: participation.id,
      requestId: request.id,
      type,
      idempotencyKey: idempotencyKey ?? null,
      createdAt: new Date(),
    });
    participation.lastEventId = eventId;

    const deepLink = `rehma://request/${request.id}?p=${participation.id}`;
    if (request.requesterUserId != null) {
      this.notifications.create({
        recipient: { role: 'user', userId: request.requesterUserId },
        type,
        title: type === 'blood_request_completed' ? 'Blood request completed' : 'Blood request updated',
        message: `Update on blood request #${request.id}`,
        entityType: 'blood_request',
        entityId: request.id,
        metadata: { eventId, participationId: participation.id, deepLink },
      });
      await this.pushDelivery?.deliverToUser(
        request.requesterUserId,
        type === 'blood_request_completed' ? 'Blood request completed' : 'Blood request updated',
        `Update on blood request #${request.id}`,
        { deepLink, requestId: String(request.id), participationId: String(participation.id) },
      );
    }
    await this.pushDelivery?.deliverToUser(
      participation.ownerUserId,
      type === 'blood_request_completed' ? 'Donation reported' : 'Commitment updated',
      `Blood request #${request.id}`,
      { deepLink, requestId: String(request.id), participationId: String(participation.id) },
    );
  }
}
