import { AppStorageService } from '../storage/app-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BloodRequestsService } from './blood-requests.service';

class StubGateway {
  emitNotification() {}
  emitUnreadCount() {}
  emitNotificationUpdate() {}
}

describe('BloodRequestsService - requestAnyAvailableDonor', () => {
  let storage: AppStorageService;
  let notifications: NotificationsService;
  let service: BloodRequestsService;

  beforeEach(async () => {
    storage = new AppStorageService();
    await storage.onModuleInit();
    const gateway = new StubGateway();
    notifications = new NotificationsService(storage as any, gateway as any);
    service = new BloodRequestsService(storage as any, notifications as any);
  });

  it('uses createdByUserId when donor.userId is null', () => {
    // create donors matching the sample payload
    storage.addDonor({
      fullName: 'dfsaf Khan',
      email: 'dfads@example.com',
      phone: '+92 300 478848474',
      bloodGroup: 'B+',
      latitude: 31.5204,
      longitude: 74.3587,
      createdByUserId: 1,
      isAvailable: true,
    });

    storage.addDonor({
      fullName: 'ghghg Khan',
      email: 'GFDSGDF@example.com',
      phone: '+92 300 54684446',
      bloodGroup: 'AB+',
      latitude: 31.5204,
      longitude: 74.3587,
      createdByUserId: 1,
      isAvailable: true,
    });

    storage.registerDonor({
      fullName: 'Muhammad Ali',
      email: 'ali@example.com',
      phone: '+564648786432448',
      bloodGroup: 'O+',
      latitude: 31.5204,
      longitude: 74.3587,
      userId: 1,
      createdByUserId: 1,
      isVerifiedAccount: true,
      passwordHash: 'x',
    });

    const req = storage.addBloodRequest({
      requesterUserId: 2,
      bloodGroup: 'B+',
      requiredUnits: 1,
      urgency: 'normal',
      latitude: 31.52,
      longitude: 74.35,
    });

    const res = service.requestAnyAvailableDonor(req.id, 2);

    expect(res).toBeDefined();
    expect(res.message).toBe('Blood request sent to an available donor');
    expect(res.donor.bloodGroup).toBe('B+');
  });

  it('scheduleBloodRequest allows donor created by user but not yet claimed', () => {
    storage.addDonor({
      fullName: 'Unclaimed Created Donor',
      email: 'unclaimed@example.com',
      phone: '+92 300 1111111',
      bloodGroup: 'A+',
      latitude: 31.5204,
      longitude: 74.3587,
      createdByUserId: 1,
      isAvailable: true,
    });

    const req = storage.addBloodRequest({
      requesterUserId: 10,
      bloodGroup: 'A+',
      requiredUnits: 1,
      urgency: 'normal',
      latitude: 31.52,
      longitude: 74.35,
    });

    const scheduleDate = new Date('2026-05-20T10:00:00.000Z');
    const result = service.scheduleBloodRequest(req.id, 1, scheduleDate);

    expect(result.bloodRequest.status).toBe('accepted');
    expect(result.donor.id).toBeDefined();
    expect(result.donor.bloodGroup).toBe('A+');
  });

  it('scheduleBloodRequest ignores donor claimed by another user', () => {
    const claimedDonor = storage.addDonor({
      fullName: 'Claimed Donor',
      email: 'claimed@example.com',
      phone: '+92 300 2222222',
      bloodGroup: 'A+',
      latitude: 31.5204,
      longitude: 74.3587,
      createdByUserId: 1,
      isAvailable: true,
    });

    storage.markDonorClaimed(claimedDonor.id, 2, 2);

    const req = storage.addBloodRequest({
      requesterUserId: 10,
      bloodGroup: 'A+',
      requiredUnits: 1,
      urgency: 'normal',
      latitude: 31.52,
      longitude: 74.35,
    });

    const scheduleDate = new Date('2026-05-20T10:00:00.000Z');

    expect(() => service.scheduleBloodRequest(req.id, 1, scheduleDate)).toThrow('No available donor matching the blood request');
  });
});
