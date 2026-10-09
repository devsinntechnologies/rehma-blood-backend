import { BadRequestException } from '@nestjs/common';

/** Participation statuses that reserve capacity (unreported portion). */
export const ACTIVE_RESERVED_STATUSES = new Set(['accepted', 'scheduled']);

/** Reported but not fully confirmed (excluding disputed bucket). */
export const REPORTED_AWAITING_STATUSES = new Set(['reported', 'partially_confirmed']);

export const DISPUTED_STATUSES = new Set(['disputed']);

export type ParticipationUnitSlice = {
  status: string;
  unitsCommitted: number;
  unitsReported: number;
  unitsConfirmed: number;
};

export type RequestUnitSummary = {
  requiredUnits: number;
  confirmedReceivedUnits: number;
  reportedAwaitingUnits: number;
  disputedUnits: number;
  activeReservedUnits: number;
  remainingNeed: number;
  capacityForNewCommitments: number;
};

function clampNonNegative(n: number): number {
  return n < 0 ? 0 : n;
}

/** Unreported reservation for accepted/scheduled participations. */
export function unreportedReservedUnits(p: ParticipationUnitSlice): number {
  if (!ACTIVE_RESERVED_STATUSES.has(p.status)) return 0;
  return clampNonNegative(p.unitsCommitted - p.unitsReported);
}

/** Unresolved reported quantity (partial receipt remainder, not yet confirmed or disputed). */
export function reportedAwaitingSlice(p: ParticipationUnitSlice): number {
  if (!REPORTED_AWAITING_STATUSES.has(p.status)) return 0;
  return clampNonNegative(p.unitsReported - p.unitsConfirmed);
}

/** Disputed units retain capacity until admin resolves (do not count as confirmed). */
export function disputedSlice(p: ParticipationUnitSlice): number {
  if (!DISPUTED_STATUSES.has(p.status)) return 0;
  return clampNonNegative(p.unitsReported - p.unitsConfirmed);
}

export function summarizeRequestUnits(
  requiredUnits: number,
  participations: ParticipationUnitSlice[],
): RequestUnitSummary {
  const required = Math.max(1, requiredUnits);
  let confirmedReceivedUnits = 0;
  let reportedAwaitingUnits = 0;
  let disputedUnits = 0;
  let activeReservedUnits = 0;

  for (const p of participations) {
    confirmedReceivedUnits += clampNonNegative(p.unitsConfirmed);
    reportedAwaitingUnits += reportedAwaitingSlice(p);
    disputedUnits += disputedSlice(p);
    activeReservedUnits += unreportedReservedUnits(p);
  }

  const remainingNeed = clampNonNegative(required - confirmedReceivedUnits);
  const capacityForNewCommitments = clampNonNegative(
    required - confirmedReceivedUnits - reportedAwaitingUnits - disputedUnits - activeReservedUnits,
  );

  return {
    requiredUnits: required,
    confirmedReceivedUnits,
    reportedAwaitingUnits,
    disputedUnits,
    activeReservedUnits,
    remainingNeed,
    capacityForNewCommitments,
  };
}

export function assertCommitmentWithinCapacity(
  summary: RequestUnitSummary,
  unitsCommitted: number,
): void {
  const units = Math.max(1, Math.floor(unitsCommitted));
  if (units > summary.capacityForNewCommitments) {
    throw new BadRequestException(
      `Requested commitment (${units} unit(s)) exceeds available capacity (${summary.capacityForNewCommitments})`,
    );
  }
}
