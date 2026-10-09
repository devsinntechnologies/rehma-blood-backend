import { AppStorageService } from '../storage/app-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IdempotencyService } from '../shared/idempotency.service';
import { ParticipationLifecycleService } from '../blood-requests/participation-lifecycle.service';
import { ParticipationInviteService } from '../blood-requests/participation-invite.service';
import { ConfigService } from '@nestjs/config';
import {
  CompositePushDeliveryProvider,
  MockPushDeliveryProvider,
  PushDeliveryService,
} from '../notifications/push-delivery.service';
import { FcmPushDeliveryProvider } from '../notifications/fcm-push-delivery.provider';
import { ParticipationMigrationService } from '../blood-requests/participation-migration.service';

class StubGateway {
  emitNotification() {}
  emitUnreadCount() {}
  emitNotificationUpdate() {}
}

async function buildStack() {
  const storage = new AppStorageService();
  await storage.onModuleInit();
  const notifications = new NotificationsService(storage as any, new StubGateway() as any);
  const idempotency = new IdempotencyService(storage);
  const mockPush = new MockPushDeliveryProvider();
  const config = { get: () => undefined } as unknown as ConfigService;
  const composite = new CompositePushDeliveryProvider(config, new FcmPushDeliveryProvider(config), mockPush);
  const push = new PushDeliveryService(storage, composite);
  const lifecycle = new ParticipationLifecycleService(storage, notifications, idempotency, null, push);
  const invite = new ParticipationInviteService(storage, lifecycle, notifications);
  (lifecycle as any).inviteService = invite;
  return { storage, lifecycle, idempotency, invite, mockPush };
}

describe('BloodBridge requester/donor journey (integration)', () => {
  it('create → invite → accept → partial report → confirm → complete accounting', async () => {
    const { storage, lifecycle } = await buildStack();

    const requester = storage.registerUser({
      fullName: 'Requester',
      email: 'req@journey.test',
      mobileNumber: '3009000001',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'A+',
      passwordHash: 'x',
    });
    const donorOwner = storage.registerUser({
      fullName: 'DonorOwner',
      email: 'don@journey.test',
      mobileNumber: '3009000002',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'A+',
      passwordHash: 'x',
    });
    const donor = storage.addDonor({
      fullName: 'Donor',
      email: 'donor@journey.test',
      phone: '3009000003',
      bloodGroup: 'A+',
      latitude: 0,
      longitude: 0,
      createdByUserId: donorOwner.id,
    });

    const request = storage.addBloodRequest({
      requesterUserId: requester.id,
      requesterName: requester.fullName,
      requesterContact: requester.mobileNumber,
      bloodGroup: 'A+',
      requiredUnits: 2,
      urgency: 'normal',
      notes: 'journey',
      latitude: 0,
      longitude: 0,
      hospitalName: 'City Hospital',
      contactPhone: '3009000009',
      deadlineAt: new Date(Date.now() + 86400000),
    });

    const participation = storage.addParticipation({
      requestId: request.id,
      donorId: donor.id,
      ownerUserId: donorOwner.id,
      historicalOwnerUserId: null,
      status: 'invited',
      responseType: null,
      unitsCommitted: 0,
      unitsReported: 0,
      unitsConfirmed: 0,
      legacyMigrated: false,
      needsAdminReconciliation: false,
      quantityConfidence: 'exact',
      offeredAt: new Date(),
      agreedAt: null,
      inviteExpiresAt: new Date(Date.now() + 3600000),
      reportedAt: null,
      receiptConfirmedAt: null,
      disputeReason: null,
      lastEventId: null,
    });

    await lifecycle.respond(
      participation.id,
      { userId: donorOwner.id, role: 'user' },
      { response: 'can_help', unitsCommitted: 2 },
      'accept-journey',
    );

    await lifecycle.reportDonation(
      participation.id,
      { userId: donorOwner.id, role: 'user' },
      2,
      'report-full',
    );

    const afterReport = storage.getParticipation(participation.id)!;
    expect(afterReport.unitsReported).toBe(2);
    expect(afterReport.status).toBe('reported');

    await lifecycle.confirmReceipt(
      participation.id,
      { userId: requester.id, role: 'user' },
      1,
      'confirm-partial',
    );

    const tracking = lifecycle.getTracking(request.id, { userId: requester.id, role: 'user' });
    expect(tracking.summary.remainingNeed).toBeGreaterThanOrEqual(0);

    await lifecycle.dispute(
      participation.id,
      { userId: requester.id, role: 'user' },
      'units mismatch',
      'dispute-1',
    );
    expect(storage.getParticipation(participation.id)!.status).toBe('disputed');

    await lifecycle.adminResolveDispute(
      participation.id,
      { userId: 1, role: 'superadmin' },
      { outcome: 'confirm_units', unitsConfirmed: 1, reason: 'admin verified' },
      'resolve-1',
    );
    expect(storage.getParticipation(participation.id)!.status).toBe('resolved_confirmed');
  });

  it('legacy migration is idempotent and preserves unknown legacy quantities', async () => {
    const storage = new AppStorageService();
    await storage.onModuleInit();

    const request = storage.addBloodRequest({
      requesterUserId: 1,
      requesterName: 'Legacy',
      requesterContact: '3000000000',
      bloodGroup: 'O+',
      requiredUnits: 3,
      urgency: 'normal',
      notes: '',
      latitude: 0,
      longitude: 0,
    });
    request.status = 'donation_completed';
    request.received = true;
    const donor = storage.addDonor({
      fullName: 'Legacy Donor',
      email: 'legacy@test',
      phone: '3000000001',
      bloodGroup: 'O+',
      latitude: 0,
      longitude: 0,
      createdByUserId: 2,
    });
    request.fulfilledByDonorId = donor.id;

    const migration = new ParticipationMigrationService(storage);
    migration.migrateIfNeeded();
    const first = storage.listParticipationsForRequest(request.id);
    expect(first.length).toBe(1);
    expect(first[0].quantityConfidence).toBe('unknown_legacy');
    expect(first[0].needsAdminReconciliation).toBe(true);

    migration.migrateIfNeeded();
    const second = storage.listParticipationsForRequest(request.id);
    expect(second.length).toBe(1);
    expect(second[0].id).toBe(first[0].id);
  });
});
