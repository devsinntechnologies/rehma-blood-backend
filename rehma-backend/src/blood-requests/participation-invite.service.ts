import { Injectable, Logger } from '@nestjs/common';
import { AppStorageService, BloodRequestRecord } from '../storage/app-storage.service';
import { ParticipationLifecycleService } from './participation-lifecycle.service';
import { summarizeRequestUnits } from './unit-accounting.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ParticipationInviteService {
  private readonly logger = new Logger(ParticipationInviteService.name);

  constructor(
    private readonly storage: AppStorageService,
    private readonly lifecycle: ParticipationLifecycleService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Sends invitations to the next eligible donors when capacity remains.
   * Respects INVITE_MAX_OUTSTANDING and skips donors already tied to this request.
   */
  reassignAfterSlotReleased(requestId: number): BloodRequestRecord | undefined {
    const request = this.storage.getBloodRequest(requestId);
    if (!request || !this.storage.isRequestAcceptingNewCommitments(request)) {
      return request;
    }

    const participations = this.storage.listParticipationsForRequest(requestId);
    const summary = summarizeRequestUnits(request.requiredUnits, participations);
    if (summary.capacityForNewCommitments <= 0) {
      return request;
    }

    const maxOutstanding = Number(process.env.INVITE_MAX_OUTSTANDING ?? 3);
    const batchSize = Number(process.env.INVITE_REASSIGN_BATCH ?? 1);
    const outstanding = participations.filter((p) => p.status === 'invited').length;
    const slots = Math.min(batchSize, maxOutstanding - outstanding, summary.capacityForNewCommitments);
    if (slots <= 0) {
      return request;
    }

    const blockedDonorIds = new Set(
      participations
        .filter((p) =>
          !['expired', 'declined', 'cancelled', 'withdrawn', 'unsuccessful', 'no_show'].includes(p.status),
        )
        .map((p) => p.donorId),
    );

    const candidates = this.eligibleDonorsForRequest(request).filter((d) => !blockedDonorIds.has(d.id));
    if (!candidates.length) {
      this.storage.updateBloodRequest(requestId, {
        status: 'active',
        requestedToDonorId: null,
        requestedToDonorName: null,
      });
      return this.storage.getBloodRequest(requestId);
    }

    const windowMs = request.urgency === 'urgent' ? 45 * 60_000 : 4 * 60 * 60_000;
    let lastRequest = request;

    for (let i = 0; i < slots && i < candidates.length; i += 1) {
      const donor = candidates[i];
      const ownerUserId = this.storage.getDonorOwnerUserId(donor) ?? donor.createdByUserId ?? 0;
      const participation = this.lifecycle.createInviteParticipation(
        lastRequest,
        donor.id,
        ownerUserId,
        new Date(Date.now() + windowMs),
      );

      lastRequest =
        this.storage.updateBloodRequest(requestId, {
          status: 'request_pending',
          requestedToDonorId: donor.id,
          requestedToDonorName: donor.fullName,
        }) ?? lastRequest;

      if (ownerUserId) {
        this.notifications.create({
          recipient: { role: 'user', userId: ownerUserId },
          type: 'system',
          title: 'Incoming blood request',
          message: `A blood request for ${request.bloodGroup} is waiting for you.`,
          entityType: 'blood_request',
          entityId: requestId,
          metadata: {
            bloodRequest: lastRequest,
            donor,
            participationId: participation.id,
            deepLink: `rehma://request/${requestId}?p=${participation.id}`,
          },
        });
      }
    }

    this.logger.log(`Reassigned request #${requestId} to ${Math.min(slots, candidates.length)} donor(s)`);
    return this.storage.getBloodRequest(requestId);
  }

  private eligibleDonorsForRequest(request: BloodRequestRecord) {
    const requesterUserId = request.requesterUserId;
    return this.storage
      .listDonors()
      .filter((donor) => {
        const ownerUserId = this.storage.getDonorOwnerUserId(donor) ?? donor.createdByUserId ?? null;
        return (
          ownerUserId != null &&
          ownerUserId !== requesterUserId &&
          donor.isActive &&
          donor.isAvailable &&
          donor.availabilityStatus === 'Available' &&
          donor.bloodGroup &&
          donor.bloodGroup.toLowerCase() === request.bloodGroup.toLowerCase()
        );
      })
      .sort((a, b) => a.id - b.id);
  }
}
