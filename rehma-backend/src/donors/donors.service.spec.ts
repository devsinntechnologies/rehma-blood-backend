import { AppStorageService } from '../storage/app-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DonorsService } from './donors.service';

class StubGateway {
  emitNotification() {}
  emitUnreadCount() {}
  emitNotificationUpdate() {}
}

describe('DonorsService - getCreatedDonors', () => {
  let storage: AppStorageService;
  let notifications: NotificationsService;
  let service: DonorsService;

  beforeEach(async () => {
    storage = new AppStorageService();
    await storage.onModuleInit();
    const gateway = new StubGateway();
    notifications = new NotificationsService(storage as any, gateway as any);
    service = new DonorsService(storage as any, notifications as any);
  });

  it('keeps multiple phone-less donor records created by the same user', () => {
    const first = storage.addDonor({
      fullName: 'First No Phone',
      email: 'first@example.com',
      phone: null,
      bloodGroup: 'A+',
      latitude: 31.5204,
      longitude: 74.3587,
      createdByUserId: 7,
      isAvailable: true,
    });

    const second = storage.addDonor({
      fullName: 'Second No Phone',
      email: 'second@example.com',
      phone: null,
      bloodGroup: 'B+',
      latitude: 31.5204,
      longitude: 74.3587,
      createdByUserId: 7,
      isAvailable: true,
    });

    const result = service.getCreatedDonors(7);

    expect(result).toHaveLength(2);
    expect(result.map((donor) => donor.id).sort((left, right) => left - right)).toEqual([first.id, second.id]);
  });
});