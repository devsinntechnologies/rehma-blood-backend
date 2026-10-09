import { AppStorageService } from '../storage/app-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IdempotencyService } from '../shared/idempotency.service';
import { ParticipationLifecycleService } from './participation-lifecycle.service';
import { ParticipationInviteService } from './participation-invite.service';
import { ConfigService } from '@nestjs/config';
import {
  CompositePushDeliveryProvider,
  MockPushDeliveryProvider,
  PushDeliveryService,
} from '../notifications/push-delivery.service';
import { FcmPushDeliveryProvider } from '../notifications/fcm-push-delivery.provider';

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

describe('Participation concurrency & idempotency (integration)', () => {
  beforeEach(async () => {
    const s = new AppStorageService();
    await s.onModuleInit();
  });

  it('accept races: only one commitment wins capacity', async () => {
    const { storage, lifecycle } = await buildStack();

    const requester = storage.registerUser({
      fullName: 'R',
      email: 'r@c.test',
      mobileNumber: '3001000001',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'O+',
      passwordHash: 'x',
    });
    const owner1 = storage.registerUser({
      fullName: 'O1',
      email: 'o1@c.test',
      mobileNumber: '3001000002',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'O+',
      passwordHash: 'x',
    });
    const owner2 = storage.registerUser({
      fullName: 'O2',
      email: 'o2@c.test',
      mobileNumber: '3001000003',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'O+',
      passwordHash: 'x',
    });
    const d1 = storage.addDonor({
      fullName: 'D1',
      email: 'd1@c.test',
      phone: '3002000001',
      bloodGroup: 'O+',
      latitude: 0,
      longitude: 0,
      createdByUserId: owner1.id,
    });
    const d2 = storage.addDonor({
      fullName: 'D2',
      email: 'd2@c.test',
      phone: '3002000002',
      bloodGroup: 'O+',
      latitude: 0,
      longitude: 0,
      createdByUserId: owner2.id,
    });
    const request = storage.addBloodRequest({
      requesterUserId: requester.id,
      bloodGroup: 'O+',
      requiredUnits: 1,
      urgency: 'normal',
      latitude: 0,
      longitude: 0,
    });

    const p1 = lifecycle.createInviteParticipation(request, d1.id, owner1.id, new Date(Date.now() + 3600_000));
    const p2 = lifecycle.createInviteParticipation(request, d2.id, owner2.id, new Date(Date.now() + 3600_000));

    const results = await Promise.allSettled([
      lifecycle.respond(p1.id, { userId: owner1.id, role: 'user' }, { response: 'can_help', unitsCommitted: 1 }, 'race-1'),
      lifecycle.respond(p2.id, { userId: owner2.id, role: 'user' }, { response: 'can_help', unitsCommitted: 1 }, 'race-2'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r) => r.status === 'rejected').length;
    expect(fulfilled).toBe(1);
    expect(rejected).toBe(1);
  });

  it('idempotent report does not double-apply cooldown or units', async () => {
    const { storage, lifecycle } = await buildStack();

    const owner = storage.registerUser({
      fullName: 'O',
      email: 'o@id.test',
      mobileNumber: '3003000001',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'A+',
      passwordHash: 'x',
    });
    const requester = storage.registerUser({
      fullName: 'Req',
      email: 'req@id.test',
      mobileNumber: '3003000002',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'A+',
      passwordHash: 'x',
    });
    const donor = storage.addDonor({
      fullName: 'D',
      email: 'd@id.test',
      phone: '3004000001',
      bloodGroup: 'A+',
      latitude: 0,
      longitude: 0,
      createdByUserId: owner.id,
      isAvailable: true,
    });
    const request = storage.addBloodRequest({
      requesterUserId: requester.id,
      bloodGroup: 'A+',
      requiredUnits: 2,
      urgency: 'normal',
      latitude: 0,
      longitude: 0,
    });
    const p = lifecycle.createInviteParticipation(request, donor.id, owner.id, new Date(Date.now() + 3600_000));
    await lifecycle.respond(p.id, { userId: owner.id, role: 'user' }, { response: 'can_help', unitsCommitted: 2 }, 'acc');

    const first = await lifecycle.reportDonation(p.id, { userId: owner.id, role: 'user' }, 1, 'rep-key');
    const second = await lifecycle.reportDonation(p.id, { userId: owner.id, role: 'user' }, 1, 'rep-key');
    expect(second.replayed).toBe(true);

    const updated = storage.getParticipation(p.id)!;
    expect(updated.unitsReported).toBe(1);
    expect(first.body).toEqual(second.body);
  });

  it('partial receipt leaves remaining need and does not mark request received', async () => {
    const { storage, lifecycle } = await buildStack();

    const requester = storage.registerUser({
      fullName: 'R',
      email: 'pr@test',
      mobileNumber: '3005000001',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'B+',
      passwordHash: 'x',
    });
    const owner = storage.registerUser({
      fullName: 'O',
      email: 'po@test',
      mobileNumber: '3005000002',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'B+',
      passwordHash: 'x',
    });
    const donor = storage.addDonor({
      fullName: 'D',
      email: 'pd@test',
      phone: '3006000001',
      bloodGroup: 'B+',
      latitude: 0,
      longitude: 0,
      createdByUserId: owner.id,
    });
    const request = storage.addBloodRequest({
      requesterUserId: requester.id,
      bloodGroup: 'B+',
      requiredUnits: 2,
      urgency: 'normal',
      latitude: 0,
      longitude: 0,
    });
    const p = lifecycle.createInviteParticipation(request, donor.id, owner.id, new Date(Date.now() + 3600_000));
    await lifecycle.respond(p.id, { userId: owner.id, role: 'user' }, { response: 'can_help', unitsCommitted: 2 }, 'a');
    await lifecycle.reportDonation(p.id, { userId: owner.id, role: 'user' }, 2, 'r');

    await lifecycle.confirmReceipt(p.id, { userId: requester.id, role: 'user' }, 1, 'c1');
    const req = storage.getBloodRequest(request.id)!;
    expect(req.received).not.toBe(true);
    const part = storage.getParticipation(p.id)!;
    expect(part.status).toBe('partially_confirmed');
    expect(part.unitsConfirmed).toBe(1);
  });

  it('rejects cumulative confirm above reported quantity', async () => {
    const { storage, lifecycle } = await buildStack();
    const requester = storage.registerUser({
      fullName: 'R',
      email: 'cum@test',
      mobileNumber: '3009000001',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'A+',
      passwordHash: 'x',
    });
    const owner = storage.registerUser({
      fullName: 'O',
      email: 'cumo@test',
      mobileNumber: '3009000002',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'A+',
      passwordHash: 'x',
    });
    const donor = storage.addDonor({
      fullName: 'D',
      email: 'cumd@test',
      phone: '3009000003',
      bloodGroup: 'A+',
      latitude: 0,
      longitude: 0,
      createdByUserId: owner.id,
    });
    const request = storage.addBloodRequest({
      requesterUserId: requester.id,
      bloodGroup: 'A+',
      requiredUnits: 2,
      urgency: 'normal',
      latitude: 0,
      longitude: 0,
    });
    const p = lifecycle.createInviteParticipation(request, donor.id, owner.id, new Date(Date.now() + 3600_000));
    await lifecycle.respond(p.id, { userId: owner.id, role: 'user' }, { response: 'can_help', unitsCommitted: 1 }, 'a');
    await lifecycle.reportDonation(p.id, { userId: owner.id, role: 'user' }, 1, 'r');
    await lifecycle.confirmReceipt(p.id, { userId: requester.id, role: 'user' }, 1, 'c1');
    await expect(
      lifecycle.confirmReceipt(p.id, { userId: requester.id, role: 'user' }, 1, 'c2'),
    ).rejects.toThrow();
  });

  it('managed-donor claim transfers active participation owner', async () => {
    const { storage, lifecycle } = await buildStack();

    const creator = storage.registerUser({
      fullName: 'C',
      email: 'c@own.test',
      mobileNumber: '3007000001',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'O+',
      passwordHash: 'x',
    });
    const claimant = storage.registerUser({
      fullName: 'N',
      email: 'n@own.test',
      mobileNumber: '3007000002',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'O+',
      passwordHash: 'x',
    });
    const donor = storage.addDonor({
      fullName: 'M',
      email: 'm@own.test',
      phone: '3008000001',
      bloodGroup: 'O+',
      latitude: 0,
      longitude: 0,
      createdByUserId: creator.id,
    });
    const request = storage.addBloodRequest({
      requesterUserId: creator.id + 100,
      bloodGroup: 'O+',
      requiredUnits: 1,
      urgency: 'normal',
      latitude: 0,
      longitude: 0,
    });
    const p = lifecycle.createInviteParticipation(request, donor.id, creator.id, new Date(Date.now() + 3600_000));
    await lifecycle.respond(p.id, { userId: creator.id, role: 'user' }, { response: 'can_help', unitsCommitted: 1 }, 'x');

    lifecycle.transferOwnershipForDonorClaim(donor.id, claimant.id, creator.id);
    await expect(
      lifecycle.reportDonation(p.id, { userId: creator.id, role: 'user' }, 1, 'old-owner'),
    ).rejects.toThrow();
    await lifecycle.reportDonation(p.id, { userId: claimant.id, role: 'user' }, 1, 'new-owner');
    expect(storage.getParticipation(p.id)!.unitsReported).toBe(1);
  });
});
