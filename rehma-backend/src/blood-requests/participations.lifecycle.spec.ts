import { AppStorageService } from '../storage/app-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IdempotencyService } from '../shared/idempotency.service';
import { ParticipationLifecycleService } from './participation-lifecycle.service';

class StubGateway {
  emitNotification() {}
  emitUnreadCount() {}
  emitNotificationUpdate() {}
}

describe('ParticipationLifecycleService', () => {
  let storage: AppStorageService;
  let lifecycle: ParticipationLifecycleService;

  beforeEach(async () => {
    storage = new AppStorageService();
    await storage.onModuleInit();
    const notifications = new NotificationsService(storage as any, new StubGateway() as any);
    const idempotency = new IdempotencyService(storage);
    lifecycle = new ParticipationLifecycleService(storage, notifications, idempotency, null, null);
  });

  it('expires invited participations after inviteExpiresAt', async () => {
    const requester = storage.registerUser({
      fullName: 'Req',
      email: 'r@example.com',
      mobileNumber: '3004444444',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'O+',
      passwordHash: 'x',
    });
    const owner = storage.registerUser({
      fullName: 'Owner',
      email: 'o@example.com',
      mobileNumber: '3005555555',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'O+',
      passwordHash: 'x',
    });
    const donor = storage.addDonor({
      fullName: 'Donor',
      email: 'don@example.com',
      phone: '3006666666',
      bloodGroup: 'O+',
      latitude: 0,
      longitude: 0,
      createdByUserId: owner.id,
    });
    const request = storage.addBloodRequest({
      requesterName: 'Req',
      requesterContact: '3004444444',
      bloodGroup: 'O+',
      requiredUnits: 1,
      urgency: 'normal',
      notes: '',
      latitude: 0,
      longitude: 0,
      requesterUserId: requester.id,
    });
    storage.updateBloodRequest(request.id, {
      status: 'request_pending',
      requestedToDonorId: donor.id,
    });
    lifecycle.createInviteParticipation(
      storage.getBloodRequest(request.id)!,
      donor.id,
      owner.id,
      new Date(Date.now() - 1000),
    );
    const n = await lifecycle.processExpiredInvites();
    expect(n).toBe(1);
    const parts = storage.listParticipationsForRequest(request.id);
    expect(parts[0].status).toBe('expired');
    expect(storage.getBloodRequest(request.id)!.status).toBe('active');
  });

  it('transfers participation owner on donor claim', () => {
    const creator = storage.registerUser({
      fullName: 'Creator',
      email: 'c@example.com',
      mobileNumber: '3001111111',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'O+',
      passwordHash: 'x',
    });
    const claimant = storage.registerUser({
      fullName: 'Claimant',
      email: 'd@example.com',
      mobileNumber: '3002222222',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'O+',
      passwordHash: 'x',
    });
    const donor = storage.addDonor({
      fullName: 'Managed',
      email: 'm@example.com',
      phone: '3003333333',
      bloodGroup: 'B+',
      latitude: 0,
      longitude: 0,
      createdByUserId: creator.id,
      isAvailable: true,
    });
    const request = storage.addBloodRequest({
      requesterUserId: creator.id + 99,
      bloodGroup: 'B+',
      requiredUnits: 2,
      urgency: 'normal',
      latitude: 0,
      longitude: 0,
    });
    const participation = lifecycle.createInviteParticipation(request, donor.id, creator.id, new Date(Date.now() + 3600_000));
    expect(participation.ownerUserId).toBe(creator.id);

    lifecycle.transferOwnershipForDonorClaim(donor.id, claimant.id, creator.id);
    const updated = storage.getParticipation(participation.id)!;
    expect(updated.ownerUserId).toBe(claimant.id);
    expect(updated.historicalOwnerUserId).toBe(creator.id);
  });

  it('idempotent accept does not double reserve units', async () => {
    const requester = storage.registerUser({
      fullName: 'Req',
      email: 'r@example.com',
      mobileNumber: '3004444444',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'A+',
      passwordHash: 'x',
    });
    const owner = storage.registerUser({
      fullName: 'Donor Owner',
      email: 'o@example.com',
      mobileNumber: '3005555555',
      dateOfBirth: '1990-01-01',
      weight: 70,
      bloodGroup: 'A+',
      passwordHash: 'x',
    });
    const donor = storage.createDonorForUser(owner.id, {
      fullName: 'Donor Owner',
      email: 'o@example.com',
      bloodGroup: 'A+',
    });
    const request = storage.addBloodRequest({
      requesterUserId: requester.id,
      bloodGroup: 'A+',
      requiredUnits: 2,
      urgency: 'normal',
      latitude: 0,
      longitude: 0,
    });
    const invite = lifecycle.createInviteParticipation(request, donor.id, owner.id, new Date(Date.now() + 3600_000));

    await lifecycle.respond(invite.id, { userId: owner.id, role: 'user' }, { response: 'can_help', unitsCommitted: 2 }, 'key-1');
    await lifecycle.respond(invite.id, { userId: owner.id, role: 'user' }, { response: 'can_help', unitsCommitted: 2 }, 'key-1');

    const tracking = lifecycle.getTracking(request.id, { userId: requester.id, role: 'user' });
    expect(tracking.summary.activeReservedUnits).toBe(2);
    expect(tracking.summary.capacityForNewCommitments).toBe(0);
  });
});
