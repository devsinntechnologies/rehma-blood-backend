import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AppStorageService } from '../storage/app-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DonorsService } from '../donors/donors.service';
import { BloodRequestsService } from './blood-requests.service';
import { IdempotencyService } from '../shared/idempotency.service';
import { ParticipationLifecycleService } from './participation-lifecycle.service';

class StubGateway {
  emitNotification() {}
  emitUnreadCount() {}
  emitNotificationUpdate() {}
}

const REQUESTER = 2;
const DONOR_OWNER = 3;
const OTHER_USER = 4;

describe('Donation lifecycle', () => {
  let storage: AppStorageService;
  let notifications: NotificationsService;
  let requests: BloodRequestsService;
  let donors: DonorsService;

  beforeEach(async () => {
    storage = new AppStorageService();
    await storage.onModuleInit();
    notifications = new NotificationsService(storage as any, new StubGateway() as any);
    const idempotency = new IdempotencyService(storage);
    const lifecycle = new ParticipationLifecycleService(storage, notifications, idempotency, null, null);
    requests = new BloodRequestsService(storage as any, notifications, lifecycle);
    donors = new DonorsService(storage as any, notifications, lifecycle);
  });

  const addManagedDonor = (ownerUserId: number, overrides: Record<string, unknown> = {}) =>
    storage.addDonor({
      fullName: 'Managed Donor',
      email: `managed${Math.random()}@example.com`,
      phone: `+92300${Math.floor(Math.random() * 1e7)}`,
      bloodGroup: 'B+',
      latitude: 31.52,
      longitude: 74.35,
      createdByUserId: ownerUserId,
      isAvailable: true,
      ...overrides,
    });

  const addRequest = (requesterUserId = REQUESTER) =>
    storage.addBloodRequest({
      requesterUserId,
      bloodGroup: 'B+',
      requiredUnits: 1,
      urgency: 'urgent',
      latitude: 31.52,
      longitude: 74.35,
    });

  /** Request scheduled by DONOR_OWNER through their managed donor. */
  const scheduledRequest = async () => {
    const donor = addManagedDonor(DONOR_OWNER);
    const request = addRequest();
    await requests.scheduleBloodRequest(request.id, DONOR_OWNER, new Date(Date.now() + 86_400_000));
    return { donor, request };
  };

  it('refuses receipt confirmation before the donor completed the donation', async () => {
    const { donor, request } = await scheduledRequest();

    await expect(requests.confirmReceipt(request.id, true, REQUESTER)).rejects.toThrow(ConflictException);
    expect(storage.getBloodRequest(request.id)!.status).toBe('accepted');
    expect(storage.getDonor(donor.id)!.totalDonations).toBe(0);
    expect(storage.getDonor(donor.id)!.availabilityStatus).toBe('Available');
  });

  it('lets only the owner of the accepted donor complete, and credits that donor', async () => {
    const { donor, request } = await scheduledRequest();
    const decoy = addManagedDonor(OTHER_USER);

    await expect(requests.complete(request.id, OTHER_USER)).rejects.toThrow(ForbiddenException);
    expect(storage.getBloodRequest(request.id)!.status).toBe('accepted');

    const completed = await requests.complete(request.id, DONOR_OWNER);
    expect(completed!.status).toBe('donation_completed');
    expect(completed!.fulfilledByDonorId).toBe(donor.id);
    expect(storage.getDonor(donor.id)!.totalDonations).toBe(1);
    expect(storage.getDonor(donor.id)!.availabilityStatus).toBe('Recently Donated');
    expect(storage.getDonor(donor.id)!.isAvailable).toBe(false);
    expect(storage.getDonor(decoy.id)!.totalDonations).toBe(0);
    expect(storage.getBloodDonationByRequestId(request.id)!.status).toBe('completed');
  });

  it('refuses to complete a request no donor has accepted', async () => {
    const request = addRequest();
    await expect(requests.complete(request.id, DONOR_OWNER)).rejects.toThrow(ConflictException);
    expect(storage.getBloodRequest(request.id)!.status).toBe('active');
  });

  it('confirms receipt once, after completion', async () => {
    const { request } = await scheduledRequest();
    await requests.complete(request.id, DONOR_OWNER);

    await expect(requests.confirmReceipt(request.id, true, OTHER_USER)).rejects.toThrow(ForbiddenException);
    const confirmed = (await requests.confirmReceipt(request.id, true, REQUESTER))!;
    expect(confirmed.received).toBe(true);
    expect(confirmed.status).toBe('donation_completed');
    await expect(requests.confirmReceipt(request.id, true, REQUESTER)).rejects.toThrow(ConflictException);
  });

  it('rejects legacy deny-receipt when participation report exists', async () => {
    const { request } = await scheduledRequest();
    await requests.complete(request.id, DONOR_OWNER);
    await expect(requests.confirmReceipt(request.id, false, REQUESTER)).rejects.toThrow(ConflictException);
  });

  it('lists a request scheduled through a managed donor for its owner, with a pending donation', async () => {
    const { donor, request } = await scheduledRequest();

    expect(donors.getAcceptedRequests(DONOR_OWNER).map((r) => r.id)).toEqual([request.id]);
    expect(donors.getAcceptedRequests(OTHER_USER)).toEqual([]);
    expect(storage.getBloodDonationByRequestId(request.id)).toMatchObject({ donorId: donor.id, status: 'donation_pending' });
  });

  it('keeps a request accepted by a managed donor in the owner accepted list', async () => {
    const donor = addManagedDonor(DONOR_OWNER);
    const request = addRequest();
    requests.requestAnyAvailableDonor(request.id, REQUESTER, donor.id);

    expect(donors.getIncomingRequests(DONOR_OWNER).map((r) => r.id)).toEqual([request.id]);
    await donors.acceptIncomingRequest(DONOR_OWNER, request.id);

    expect(donors.getIncomingRequests(DONOR_OWNER)).toEqual([]);
    expect(donors.getAcceptedRequests(DONOR_OWNER).map((r) => r.id)).toEqual([request.id]);
    expect(storage.getBloodRequest(request.id)!.status).toBe('request_accepted');
  });

  it('does not let a requester volunteer for their own request', async () => {
    addManagedDonor(REQUESTER);
    const request = addRequest();
    await expect(requests.scheduleBloodRequest(request.id, REQUESTER, new Date())).rejects.toThrow(
      ForbiddenException,
    );
    expect(storage.getBloodRequest(request.id)!.status).toBe('active');
  });

  it('sends a direct request to the chosen donor, not the first match', () => {
    addManagedDonor(DONOR_OWNER);
    const chosen = addManagedDonor(OTHER_USER);
    const request = addRequest();

    const result = requests.requestAnyAvailableDonor(request.id, REQUESTER, chosen.id);
    expect(result.donor.id).toBe(chosen.id);
    expect(storage.getBloodRequest(request.id)!.requestedToDonorId).toBe(chosen.id);
  });

  it('refuses a direct request to an ineligible donor without changing the request', () => {
    const unavailable = addManagedDonor(OTHER_USER, { isAvailable: false });
    const request = addRequest();

    expect(() => requests.requestAnyAvailableDonor(request.id, REQUESTER, unavailable.id)).toThrow(ForbiddenException);
    expect(storage.getBloodRequest(request.id)!.status).toBe('active');
    expect(storage.getBloodRequest(request.id)!.requestedToDonorId).toBeNull();
  });

  it('only treats Available as available', () => {
    const donor = addManagedDonor(DONOR_OWNER);
    for (const status of ['Emergency Only', 'Not Available', 'Recently Donated'] as const) {
      expect(storage.updateDonorAvailabilityStatus(donor.id, status)!.isAvailable).toBe(false);
    }
    expect(storage.updateDonorAvailabilityStatus(donor.id, 'Available')!.isAvailable).toBe(true);
  });

  it('does not show incoming requests to the creator of a donor someone else claimed', () => {
    const donor = addManagedDonor(DONOR_OWNER);
    storage.updateDonor(donor.id, { linkedUserId: OTHER_USER, claimedByUserId: OTHER_USER });
    const request = addRequest();
    requests.requestAnyAvailableDonor(request.id, REQUESTER, donor.id);

    expect(donors.getIncomingRequests(DONOR_OWNER)).toEqual([]);
    expect(donors.getIncomingRequests(OTHER_USER).map((r) => r.id)).toEqual([request.id]);
  });

  it('removes the pending donation when a request is deleted', async () => {
    const { request } = await scheduledRequest();
    await expect(requests.remove(request.id, OTHER_USER, 'user')).rejects.toThrow(ForbiddenException);
    await requests.remove(request.id, REQUESTER, 'user');
    expect(storage.getBloodRequest(request.id)).toBeUndefined();
    expect(storage.getBloodDonationByRequestId(request.id)).toBeUndefined();
  });

  it('refuses a second donor with the same email instead of overwriting it', () => {
    const existing = addManagedDonor(DONOR_OWNER);
    expect(() =>
      donors.create(
        { fullName: 'Someone else', email: existing.email!, phone: '+923001112223', bloodGroup: 'O+', latitude: 1, longitude: 1 } as any,
        OTHER_USER,
      ),
    ).toThrow(ConflictException);
    expect(storage.getDonor(existing.id)!.fullName).toBe('Managed Donor');
    expect(storage.getDonor(existing.id)!.createdByUserId).toBe(DONOR_OWNER);
  });

  it('only lets a Super Admin change isActive', async () => {
    const donor = addManagedDonor(DONOR_OWNER);
    await expect(donors.update(donor.id, { isActive: true } as any, DONOR_OWNER, 'user')).rejects.toThrow(ForbiddenException);
    await donors.update(donor.id, { isActive: false } as any, 1, 'superadmin');
    expect(storage.getDonor(donor.id)!.isActive).toBe(false);
  });
});
