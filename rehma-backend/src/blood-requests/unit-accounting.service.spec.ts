import {
  assertCommitmentWithinCapacity,
  summarizeRequestUnits,
} from './unit-accounting.service';

describe('UnitAccountingService', () => {
  it('computes remaining need only from confirmed units', () => {
    const summary = summarizeRequestUnits(3, [
      { status: 'accepted', unitsCommitted: 1, unitsReported: 0, unitsConfirmed: 0 },
      { status: 'reported', unitsCommitted: 1, unitsReported: 1, unitsConfirmed: 0 },
      { status: 'receipt_confirmed', unitsCommitted: 1, unitsReported: 1, unitsConfirmed: 1 },
    ]);
    expect(summary.confirmedReceivedUnits).toBe(1);
    expect(summary.remainingNeed).toBe(2);
    expect(summary.reportedAwaitingUnits).toBe(1);
    expect(summary.activeReservedUnits).toBe(1);
    expect(summary.capacityForNewCommitments).toBe(0);
  });

  it('rejects commitment above capacity', () => {
    const summary = summarizeRequestUnits(2, [
      { status: 'accepted', unitsCommitted: 2, unitsReported: 0, unitsConfirmed: 0 },
    ]);
    expect(() => assertCommitmentWithinCapacity(summary, 1)).toThrow();
  });

  it('counts disputed units against capacity', () => {
    const summary = summarizeRequestUnits(2, [
      { status: 'disputed', unitsCommitted: 1, unitsReported: 1, unitsConfirmed: 0 },
    ]);
    expect(summary.disputedUnits).toBe(1);
    expect(summary.capacityForNewCommitments).toBe(1);
  });
});
