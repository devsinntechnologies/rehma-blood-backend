import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AppStorageService, BloodRequestRecord, RequestParticipationRecord } from '../storage/app-storage.service';

const MIGRATION_VERSION = 1;

/**
 * Backfills participations from legacy request/donation rows without inferring
 * that all required units were donated or received.
 */
@Injectable()
export class ParticipationMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ParticipationMigrationService.name);

  constructor(private readonly storage: AppStorageService) {}

  onApplicationBootstrap(): void {
    this.migrateIfNeeded();
  }

  migrateIfNeeded(): void {
    const state = this.storage.exportState();
    const already = state.requestParticipations.some((p) => p.legacyMigrated);
    if (already && state.bloodRequests.every((r) => (r.legacyMigrationVersion ?? 0) >= MIGRATION_VERSION)) {
      return;
    }

    let created = 0;
    for (const request of state.bloodRequests) {
      if ((request.legacyMigrationVersion ?? 0) >= MIGRATION_VERSION) continue;
      const existing = state.requestParticipations.filter((p) => p.requestId === request.id);
      if (existing.length > 0) {
        const allReconciled = existing.every(
          (p) => !p.needsAdminReconciliation || p.quantityConfidence === 'admin_reconciled',
        );
        if (allReconciled) {
          request.legacyMigrationVersion = MIGRATION_VERSION;
        }
        continue;
      }

      const donorId = request.fulfilledByDonorId ?? request.acceptedByDonorId ?? request.requestedToDonorId;
      if (donorId == null) {
        request.legacyMigrationVersion = MIGRATION_VERSION;
        continue;
      }

      const donor = state.donors.find((d) => d.id === donorId);
      const ownerUserId = donor ? (donor.linkedUserId ?? donor.userId ?? donor.createdByUserId ?? 0) : 0;

      const status = this.mapLegacyParticipationStatus(request);
      const participation = this.storage.addParticipation({
        requestId: request.id,
        donorId,
        ownerUserId: ownerUserId ?? 0,
        historicalOwnerUserId: null,
        status,
        responseType: null,
        unitsCommitted: this.legacyUnitsCommitted(request, status),
        unitsReported: request.status === 'donation_completed' ? 0 : 0,
        unitsConfirmed: 0,
        legacyMigrated: true,
        needsAdminReconciliation: request.status === 'donation_completed' || request.received === true,
        quantityConfidence: 'unknown_legacy',
        offeredAt: null,
        agreedAt: request.acceptedAt ?? null,
        inviteExpiresAt: null,
        reportedAt: request.completedAt ?? null,
        receiptConfirmedAt: request.received ? request.receivedAt ?? null : null,
        disputeReason: null,
        lastEventId: null,
      });

      if (request.received === true) {
        participation.needsAdminReconciliation = true;
        participation.status = 'partially_confirmed';
      }

      this.syncLegacyRequestSummary(request, [participation]);
      request.legacyMigrationVersion = MIGRATION_VERSION;
      created += 1;
    }

    if (created > 0) {
      this.logger.log(`Legacy participation migration created ${created} participation row(s)`);
    }
  }

  private mapLegacyParticipationStatus(request: BloodRequestRecord): RequestParticipationRecord['status'] {
    if (request.status === 'cancelled') return 'cancelled';
    if (request.status === 'donation_completed') return 'reported';
    if (request.status === 'accepted' || request.status === 'on_the_way' || request.status === 'arrived_at_hospital') {
      return 'scheduled';
    }
    if (request.status === 'request_accepted') return 'accepted';
    if (request.status === 'request_pending') return 'invited';
    return 'invited';
  }

  private legacyUnitsCommitted(
    request: BloodRequestRecord,
    status: RequestParticipationRecord['status'],
  ): number {
    if (['accepted', 'scheduled', 'reported', 'partially_confirmed'].includes(status)) {
      return 1;
    }
    if (request.status === 'request_pending') return 0;
    return 0;
  }

  private syncLegacyRequestSummary(request: BloodRequestRecord, participations: RequestParticipationRecord[]): void {
    const primary = participations[0];
    if (!primary) return;
    request.acceptedByDonorId = primary.donorId;
    const donor = this.storage.getDonor(primary.donorId);
    request.acceptedByDonorName = donor?.fullName ?? request.acceptedByDonorName ?? null;
  }
}
