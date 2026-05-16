import { AppStorageService } from '../storage/app-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DonorsService } from './donors.service';
import { ConflictException } from '@nestjs/common';

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

describe('DonorsService - create', () => {
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

  it('throws conflict and does not create a donor when phone already exists', () => {
    storage.addDonor({
      fullName: 'Existing Phone',
      email: 'existing-phone@example.com',
      phone: '+92 300 1234567',
      bloodGroup: 'A+',
      latitude: 31.5204,
      longitude: 74.3587,
      createdByUserId: 1,
      isAvailable: true,
    });

    const before = storage.listDonors().length;

    expect(() =>
      service.create(
        {
          fullName: 'Duplicate Phone',
          email: 'new-email@example.com',
          phone: '+92 300 1234567',
          bloodGroup: 'B+',
          latitude: 31.5204,
          longitude: 74.3587,
        },
        2,
      ),
    ).toThrow(new ConflictException('Donor with this phone number already exists'));

    expect(storage.listDonors().length).toBe(before);
  });

  it('throws conflict and does not create a donor when email already exists', () => {
    storage.addDonor({
      fullName: 'Existing Email',
      email: 'existing-email@example.com',
      phone: '+92 300 7654321',
      bloodGroup: 'O+',
      latitude: 31.5204,
      longitude: 74.3587,
      createdByUserId: 1,
      isAvailable: true,
    });

    const before = storage.listDonors().length;

    expect(() =>
      service.create(
        {
          fullName: 'Duplicate Email',
          email: 'existing-email@example.com',
          phone: '+92 300 0000000',
          bloodGroup: 'AB+',
          latitude: 31.5204,
          longitude: 74.3587,
        },
        2,
      ),
    ).toThrow(new ConflictException('Donor with this email already exists'));

    expect(storage.listDonors().length).toBe(before);
  });
});