import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

export type SuperAdminRecord = {
  id: number;
  email: string;
  passwordHash: string;
  fullName: string;
};

export type DonorRecord = {
  id: number;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  userId?: number | null;
  bloodGroup?: string | null;
  passwordHash?: string | null;
  isActive: boolean;
  isAvailable: boolean;
  availabilityStatus?: 'Available' | 'Not Available' | 'Emergency Only' | 'Recently Donated';
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  cnic?: string | null;
  profileImage?: string | null;
  lastDonationDate?: string | null;
  medicalNotes?: string | null;
  totalDonations?: number;
  createdAt: Date;
  updatedAt: Date;
  promoCode?: string | null;
  isClaimed?: boolean;
  isVerifiedAccount?: boolean;
  claimedAt?: Date | null;
  createdByUserId?: number | null;
  claimedByUserId?: number | null;
  linkedUserId?: number | null;
  promoCodeExpiresAt?: Date | null;
  claimStatus?: 'INVITED' | 'CLAIMED' | 'EXPIRED';
};

export type BloodRequestRecord = {
  id: number;
  requesterUserId?: number | null;
  requesterName?: string | null;
  requesterContact?: string | null;
  bloodGroup: string;
  requiredUnits: number;
  urgency: 'urgent' | 'normal';
  notes?: string | null;
  latitude: number;
  longitude: number;
  status: 'active' | 'request_pending' | 'request_accepted' | 'accepted' | 'on_the_way' | 'arrived_at_hospital' | 'donation_completed';
  requestedToDonorId?: number | null;
  requestedToDonorName?: string | null;
  acceptedByDonorId?: number | null;
  acceptedByDonorName?: string | null;
  acceptedAt?: Date | null;
  scheduledDate?: Date | null;
  completedAt?: Date | null;
  fulfilledByDonorId?: number | null;
  fulfilledByDonorName?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BloodDonationRecord = {
  id: number;
  requestId?: number | null;
  donorId: number;
  donorName: string;
  bloodGroup: string;
  status: 'request_pending' | 'request_accepted' | 'donation_pending' | 'completed';
  createdAt: Date;
  updatedAt: Date;
};

export type NotificationRecord = {
  id: number;
  recipientRole: 'superadmin' | 'donor' | 'user';
  recipientUserId: number;
  type:
    | 'blood_request_created'
    | 'blood_request_updated'
    | 'blood_request_completed'
    | 'blood_request_matched'
    | 'blood_donation_created'
    | 'blood_donation_updated'
    | 'donor_created'
    | 'donor_updated'
    | 'donor_status_changed'
    | 'donor_ownership_transferred'
    | 'promo_updated'
    | 'system';
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: number | null;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserRecord = {
  id: number;
  fullName: string;
  email: string;
  mobileNumber: string;
  dateOfBirth: string;
  weight: number;
  bloodGroup: string;
  lastBloodDonation?: string | null;
  passwordHash: string;
  role: 'user';
  createdAt: Date;
  updatedAt: Date;
};

export type ResetTokenRecord = {
  token: string;
  email: string;
  userType: 'superadmin' | 'donor' | 'user';
  expiresAt: Date;
  used: boolean;
};

@Injectable()
export class AppStorageService implements OnModuleInit {
  private superAdmins: SuperAdminRecord[] = [];
  private donors: DonorRecord[] = [];
  private bloodRequests: BloodRequestRecord[] = [];
  private bloodDonations: BloodDonationRecord[] = [];
  private notifications: NotificationRecord[] = [];
  private users: UserRecord[] = [];
  private resetTokens: ResetTokenRecord[] = [];

  private donorId = 1;
  private requestId = 1;
  private donationId = 1;
  private userId = 1;

  async onModuleInit(): Promise<void> {
    const passwordHash = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe123!', 10);

    this.superAdmins = [
      {
        id: 1,
        email: process.env.SUPERADMIN_EMAIL ?? 'admin@bloodbridge.local',
        passwordHash,
        fullName: 'Super Admin',
      },
    ];
  }

  getSuperAdminByEmail(email: string): SuperAdminRecord | undefined {
    return this.superAdmins.find((superAdmin) => superAdmin.email === email);
  }

  listSuperAdmins(): SuperAdminRecord[] {
    return [...this.superAdmins];
  }

  getSuperAdminById(id: number): SuperAdminRecord | undefined {
    return this.superAdmins.find((superAdmin) => superAdmin.id === id);
  }

  getDonorByEmail(email: string): DonorRecord | undefined {
    return this.donors.find((donor) => donor.email === email);
  }

  getDonorByPhone(phone: string): DonorRecord | undefined {
    return this.donors.find((donor) => donor.phone === phone);
  }

  getDonorsByUserId(userId: number): DonorRecord[] {
    const list = this.donors
      .filter((donor) => donor.userId === userId || donor.linkedUserId === userId || donor.claimedByUserId === userId || donor.createdByUserId === userId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    list.forEach((d) => this.restoreAvailabilityIfEligible(d));
    return list;
  }

  private restoreAvailabilityIfEligible(donor: DonorRecord) {
    if (!donor || !donor.lastDonationDate) return;
    try {
      const last = new Date(donor.lastDonationDate);
      const now = new Date();
      const ms = now.getTime() - last.getTime();
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      if (days >= 60) {
        donor.isAvailable = true;
        donor.availabilityStatus = 'Available';
        donor.updatedAt = new Date();
      }
    } catch (e) {
      // ignore parsing errors
    }
  }

  getDonorOwnerUserId(donor: DonorRecord): number | null {
    return donor.linkedUserId ?? donor.userId ?? donor.createdByUserId ?? null;
  }

  hasAvailableDonor(userId: number): boolean {
    return this.donors.some((donor) => {
      const ownerUserId = this.getDonorOwnerUserId(donor);
      return ownerUserId === userId && donor.isAvailable && donor.availabilityStatus === 'Available';
    });
  }

  addOrUpdateDonor(input: {
    fullName: string;
    email?: string | null;
    phone?: string | null;
    userId?: number | null;
    bloodGroup?: string | null;
    passwordHash?: string | null;
    isAvailable?: boolean;
    availabilityStatus?: DonorRecord['availabilityStatus'];
    latitude?: number | null;
    longitude?: number | null;
    city?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    cnic?: string | null;
    profileImage?: string | null;
    lastDonationDate?: string | null;
    medicalNotes?: string | null;
    totalDonations?: number;
    promoCode?: string | null;
    createdByUserId?: number | null;
    isClaimed?: boolean;
    isVerifiedAccount?: boolean;
    linkedUserId?: number | null;
  }): DonorRecord {
    const existingDonor = input.email ? this.getDonorByEmail(input.email) : input.phone ? this.getDonorByPhone(input.phone) : undefined;
    const now = new Date();
    const availabilityStatus = input.availabilityStatus ?? (input.isAvailable === false ? 'Not Available' : 'Available');

    if (existingDonor) {
      Object.assign(existingDonor, {
        fullName: input.fullName,
        phone: input.phone ?? existingDonor.phone ?? null,
        userId: input.userId ?? existingDonor.userId ?? null,
        bloodGroup: input.bloodGroup ?? existingDonor.bloodGroup ?? null,
        passwordHash: input.passwordHash ?? existingDonor.passwordHash ?? null,
        isAvailable: input.isAvailable ?? existingDonor.isAvailable,
        availabilityStatus: availabilityStatus ?? existingDonor.availabilityStatus ?? 'Available',
        latitude: input.latitude ?? existingDonor.latitude ?? null,
        longitude: input.longitude ?? existingDonor.longitude ?? null,
        city: input.city ?? existingDonor.city ?? null,
        gender: input.gender ?? existingDonor.gender ?? null,
        dateOfBirth: input.dateOfBirth ?? existingDonor.dateOfBirth ?? null,
        cnic: input.cnic ?? existingDonor.cnic ?? null,
        profileImage: input.profileImage ?? existingDonor.profileImage ?? null,
        lastDonationDate: input.lastDonationDate ?? existingDonor.lastDonationDate ?? null,
        medicalNotes: input.medicalNotes ?? existingDonor.medicalNotes ?? null,
        totalDonations: input.totalDonations ?? existingDonor.totalDonations ?? 0,
        promoCode: input.promoCode ?? existingDonor.promoCode ?? null,
        createdByUserId: input.createdByUserId ?? existingDonor.createdByUserId ?? null,
        linkedUserId: input.linkedUserId ?? existingDonor.linkedUserId ?? null,
        isClaimed: input.isClaimed ?? existingDonor.isClaimed ?? false,
        isVerifiedAccount: input.isVerifiedAccount ?? existingDonor.isVerifiedAccount ?? false,
        updatedAt: now,
      });
      return existingDonor;
    }

    const donor: DonorRecord = {
      id: this.donorId++,
      fullName: input.fullName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      userId: input.userId ?? null,
      bloodGroup: input.bloodGroup ?? null,
      passwordHash: input.passwordHash ?? null,
      isActive: true,
      isAvailable: input.isAvailable ?? true,
      availabilityStatus,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      city: input.city ?? null,
      gender: input.gender ?? null,
      dateOfBirth: input.dateOfBirth ?? null,
      cnic: input.cnic ?? null,
      profileImage: input.profileImage ?? null,
      lastDonationDate: input.lastDonationDate ?? null,
      medicalNotes: input.medicalNotes ?? null,
      totalDonations: input.totalDonations ?? 0,
      promoCode: input.promoCode ?? null,
      isClaimed: input.isClaimed ?? false,
      isVerifiedAccount: input.isVerifiedAccount ?? false,
      createdByUserId: input.createdByUserId ?? null,
      claimedByUserId: null,
      linkedUserId: input.linkedUserId ?? null,
      promoCodeExpiresAt: null,
      claimStatus: input.isClaimed ? 'CLAIMED' : 'INVITED',
      createdAt: now,
      updatedAt: now,
    };

    this.donors.push(donor);
    return donor;
  }

  registerDonor(input: {
    fullName: string;
    email: string;
    passwordHash: string;
    phone?: string | null;
    bloodGroup?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    city?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    cnic?: string | null;
    profileImage?: string | null;
    lastDonationDate?: string | null;
    medicalNotes?: string | null;
    promoCode?: string | null;
    createdByUserId?: number | null;
    userId?: number | null;
    isVerifiedAccount?: boolean;
  }): DonorRecord {
    return this.addOrUpdateDonor({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      bloodGroup: input.bloodGroup,
      passwordHash: input.passwordHash,
      isAvailable: true,
      latitude: input.latitude,
      longitude: input.longitude,
      city: input.city,
      gender: input.gender,
      dateOfBirth: input.dateOfBirth,
      cnic: input.cnic,
      profileImage: input.profileImage,
      lastDonationDate: input.lastDonationDate,
      medicalNotes: input.medicalNotes,
      promoCode: input.promoCode ?? null,
      createdByUserId: input.createdByUserId ?? null,
      userId: input.userId ?? null,
      isVerifiedAccount: input.isVerifiedAccount ?? false,
    });
  }

  listDonors(): DonorRecord[] {
    const list = [...this.donors].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    list.forEach((d) => this.restoreAvailabilityIfEligible(d));
    return list;
  }

  addDonor(
    input: Pick<DonorRecord, 'fullName' | 'email' | 'phone' | 'bloodGroup' | 'latitude' | 'longitude'> & {
      isAvailable?: boolean;
      promoCode?: string | null;
      createdByUserId?: number | null;
      isVerifiedAccount?: boolean;
    },
  ): DonorRecord {
    return this.addOrUpdateDonor({
      ...input,
      promoCode: input.promoCode ?? null,
      createdByUserId: input.createdByUserId ?? null,
      isVerifiedAccount: input.isVerifiedAccount ?? false,
    });
  }

  getDonorByPromoCode(promoCode: string): DonorRecord | undefined {
    if (!promoCode) return undefined;
    return this.donors.find((donor) => donor.promoCode === promoCode);
  }

  getDonorByLinkedUserId(linkedUserId: number): DonorRecord | undefined {
    return this.donors.find((donor) => donor.linkedUserId === linkedUserId);
  }

  getAllDonorsByLinkedUserId(linkedUserId: number): DonorRecord[] {
    const list = this.donors
      .filter((donor) => donor.linkedUserId === linkedUserId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    list.forEach((d) => this.restoreAvailabilityIfEligible(d));
    return list;
  }

  getDonorsByCreatedByUserId(createdByUserId: number): DonorRecord[] {
    const list = this.donors
      .filter((donor) => donor.createdByUserId === createdByUserId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    list.forEach((d) => this.restoreAvailabilityIfEligible(d));
    return list;
  }

  getAllMyDonors(userId: number): DonorRecord[] {
    // Get both created donors and user's own donor profile
    const created = this.donors.filter((donor) => donor.createdByUserId === userId);
    const owned = this.donors.filter((donor) => donor.linkedUserId === userId);
    
    // Merge and remove duplicates (if a donor is both created and owned)
    const allDonors = [...created, ...owned];
    const seen = new Set<number>();
    const unique = allDonors.filter((donor) => {
      if (seen.has(donor.id)) return false;
      seen.add(donor.id);
      return true;
    });

    const sorted = unique.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    sorted.forEach((d) => this.restoreAvailabilityIfEligible(d));
    return sorted;
  }

  disablePromoCode(donorId: number): DonorRecord | undefined {
    const donor = this.getDonor(donorId);
    if (!donor) return undefined;
    donor.promoCode = null;
    donor.claimStatus = 'EXPIRED';
    donor.updatedAt = new Date();
    return donor;
  }

  regeneratePromoCode(donorId: number): { donor: DonorRecord; newPromoCode: string } | undefined {
    const donor = this.getDonor(donorId);
    if (!donor) return undefined;
    if (donor.isClaimed) {
      throw new BadRequestException('Cannot regenerate promo code for a claimed donor');
    }

    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const part = Array.from({ length: 6 })
        .map(() => chars[Math.floor(Math.random() * chars.length)])
        .join('');
      return `RB-${part}`;
    };

    let promo = generateCode();
    let attempts = 0;
    while (this.getDonorByPromoCode(promo) && attempts < 10) {
      promo = generateCode();
      attempts += 1;
    }

    donor.promoCode = promo;
    donor.claimStatus = 'INVITED';
    donor.updatedAt = new Date();
    return { donor, newPromoCode: promo };
  }

  markDonorClaimed(donorId: number, claimedByUserId: number, linkedUserId?: number): DonorRecord | undefined {
    const donor = this.getDonor(donorId);
    if (!donor) return undefined;
    donor.isClaimed = true;
    donor.claimedAt = new Date();
    donor.claimedByUserId = claimedByUserId;
    donor.linkedUserId = linkedUserId ?? claimedByUserId;
    donor.userId = linkedUserId ?? claimedByUserId;
    donor.isVerifiedAccount = true;
    donor.claimStatus = 'CLAIMED';
    donor.updatedAt = new Date();
    return donor;
  }

  transferDonorOwnership(
    donorId: number,
    userId: number,
    input?: Partial<
      Pick<
        DonorRecord,
        | 'fullName'
        | 'email'
        | 'phone'
        | 'bloodGroup'
        | 'city'
        | 'gender'
        | 'dateOfBirth'
        | 'cnic'
        | 'profileImage'
        | 'lastDonationDate'
        | 'medicalNotes'
        | 'latitude'
        | 'longitude'
        | 'availabilityStatus'
      >
    >,
  ): DonorRecord | undefined {
    const donor = this.getDonor(donorId);
    if (!donor) return undefined;

    Object.assign(donor, {
      fullName: input?.fullName ?? donor.fullName,
      email: input?.email ?? donor.email ?? null,
      phone: input?.phone ?? donor.phone ?? null,
      bloodGroup: input?.bloodGroup ?? donor.bloodGroup ?? null,
      city: input?.city ?? donor.city ?? null,
      gender: input?.gender ?? donor.gender ?? null,
      dateOfBirth: input?.dateOfBirth ?? donor.dateOfBirth ?? null,
      cnic: input?.cnic ?? donor.cnic ?? null,
      profileImage: input?.profileImage ?? donor.profileImage ?? null,
      lastDonationDate: input?.lastDonationDate ?? donor.lastDonationDate ?? null,
      medicalNotes: input?.medicalNotes ?? donor.medicalNotes ?? null,
      latitude: input?.latitude ?? donor.latitude ?? null,
      longitude: input?.longitude ?? donor.longitude ?? null,
      availabilityStatus: input?.availabilityStatus ?? donor.availabilityStatus ?? 'Available',
      isAvailable: input?.availabilityStatus ? input.availabilityStatus === 'Available' : donor.isAvailable,
      userId,
      linkedUserId: userId,
      claimedByUserId: userId,
      isClaimed: true,
      isVerifiedAccount: true,
      claimStatus: 'CLAIMED',
      claimedAt: donor.claimedAt ?? new Date(),
      updatedAt: new Date(),
    });

    return donor;
  }

  createDonorForUser(
    userId: number,
    input: {
      fullName: string;
      email: string;
      phone?: string | null;
      bloodGroup?: string | null;
      city?: string | null;
      gender?: string | null;
      dateOfBirth?: string | null;
      cnic?: string | null;
      profileImage?: string | null;
      lastDonationDate?: string | null;
      medicalNotes?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      promoCode?: string | null;
    },
  ): DonorRecord {
    return this.addOrUpdateDonor({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      userId,
      bloodGroup: input.bloodGroup,
      city: input.city,
      gender: input.gender,
      dateOfBirth: input.dateOfBirth,
      cnic: input.cnic,
      profileImage: input.profileImage,
      lastDonationDate: input.lastDonationDate,
      medicalNotes: input.medicalNotes,
      latitude: input.latitude,
      longitude: input.longitude,
      promoCode: input.promoCode ?? null,
      createdByUserId: userId,
      linkedUserId: userId,
      isClaimed: true,
      isVerifiedAccount: true,
      availabilityStatus: 'Available',
    });
  }

  createDonorFromUser(userId: number, user: UserRecord): DonorRecord {
    return this.createDonorForUser(userId, {
      fullName: user.fullName,
      email: user.email,
      phone: user.mobileNumber,
      bloodGroup: user.bloodGroup,
      dateOfBirth: user.dateOfBirth,
      lastDonationDate: user.lastBloodDonation,
    });
  }

  getDonor(id: number): DonorRecord | undefined {
    const donor = this.donors.find((donor) => donor.id === id);
    if (donor) this.restoreAvailabilityIfEligible(donor);
    return donor;
  }

  updateDonor(id: number, partial: Partial<Omit<DonorRecord, 'id' | 'createdAt' | 'updatedAt'>>): DonorRecord | undefined {
    const donor = this.getDonor(id);
    if (!donor) return undefined;
    Object.assign(donor, partial, { updatedAt: new Date() });
    return donor;
  }

  updateDonorAvailability(id: number, isAvailable: boolean): DonorRecord | undefined {
    return this.updateDonor(id, { isAvailable, availabilityStatus: isAvailable ? 'Available' : 'Not Available' });
  }

  updateDonorAvailabilityStatus(id: number, availabilityStatus: DonorRecord['availabilityStatus']): DonorRecord | undefined {
    const isAvailable = availabilityStatus === 'Available' || availabilityStatus === 'Recently Donated';
    return this.updateDonor(id, { isAvailable, availabilityStatus });
  }

  updateDonorLocation(id: number, latitude: number, longitude: number): DonorRecord | undefined {
    return this.updateDonor(id, { latitude, longitude });
  }

  authenticateDonor(email: string, password: string): DonorRecord | undefined {
    const donor = this.getDonorByEmail(email);
    if (!donor?.passwordHash) return undefined;
    return bcrypt.compareSync(password, donor.passwordHash) ? donor : undefined;
  }

  setDonorActive(id: number, isActive: boolean): DonorRecord | undefined {
    return this.updateDonor(id, { isActive });
  }

  deleteDonor(id: number): boolean {
    const index = this.donors.findIndex((donor) => donor.id === id);
    if (index === -1) return false;
    this.donors.splice(index, 1);
    return true;
  }

  listBloodRequests(): BloodRequestRecord[] {
    return [...this.bloodRequests].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  listBloodRequestsByRequesterUserId(requesterUserId: number): BloodRequestRecord[] {
    const statusPriority: Record<BloodRequestRecord['status'], number> = {
      active: 0,
      request_pending: 1,
      request_accepted: 2,
      accepted: 3,
      on_the_way: 4,
      arrived_at_hospital: 5,
      donation_completed: 6,
    };

    return this.bloodRequests
      .filter((bloodRequest) => bloodRequest.requesterUserId === requesterUserId)
      .sort((left, right) => {
        if (statusPriority[left.status] !== statusPriority[right.status]) {
          return statusPriority[left.status] - statusPriority[right.status];
        }

        if (left.urgency !== right.urgency) {
          return left.urgency === 'urgent' ? -1 : 1;
        }

        return right.createdAt.getTime() - left.createdAt.getTime();
      });
  }

  listScheduledBloodRequestsByRequesterUserId(requesterUserId: number): BloodRequestRecord[] {
    return this.bloodRequests
      .filter((bloodRequest) => bloodRequest.requesterUserId === requesterUserId && bloodRequest.scheduledDate != null)
      .sort((left, right) => {
        const leftScheduledAt = left.scheduledDate?.getTime() ?? 0;
        const rightScheduledAt = right.scheduledDate?.getTime() ?? 0;

        if (leftScheduledAt !== rightScheduledAt) {
          return leftScheduledAt - rightScheduledAt;
        }

        return right.createdAt.getTime() - left.createdAt.getTime();
      });
  }

  listAllScheduledBloodRequests(): BloodRequestRecord[] {
    return this.bloodRequests
      .filter((bloodRequest) => bloodRequest.scheduledDate != null)
      .sort((left, right) => {
        const leftScheduledAt = left.scheduledDate?.getTime() ?? 0;
        const rightScheduledAt = right.scheduledDate?.getTime() ?? 0;

        if (leftScheduledAt !== rightScheduledAt) {
          return leftScheduledAt - rightScheduledAt;
        }

        return right.createdAt.getTime() - left.createdAt.getTime();
      });
  }

  addBloodRequest(input: {
    requesterUserId?: number | null;
    requesterName?: string | null;
    requesterContact?: string | null;
    bloodGroup: string;
    requiredUnits: number;
    urgency: 'urgent' | 'normal';
    notes?: string | null;
    latitude: number;
    longitude: number;
  }): BloodRequestRecord {
    const now = new Date();
    const bloodRequest: BloodRequestRecord = {
      id: this.requestId++,
      requesterUserId: input.requesterUserId ?? null,
      requesterName: input.requesterName ?? null,
      requesterContact: input.requesterContact ?? null,
      bloodGroup: input.bloodGroup,
      requiredUnits: input.requiredUnits,
      urgency: input.urgency,
      notes: input.notes ?? null,
      latitude: input.latitude,
      longitude: input.longitude,
      status: 'active',
      requestedToDonorId: null,
      requestedToDonorName: null,
      acceptedByDonorId: null,
      acceptedByDonorName: null,
      acceptedAt: null,
      scheduledDate: null,
      completedAt: null,
      fulfilledByDonorId: null,
      fulfilledByDonorName: null,
      createdAt: now,
      updatedAt: now,
    };
    this.bloodRequests.push(bloodRequest);
    return bloodRequest;
  }

  getBloodRequest(id: number): BloodRequestRecord | undefined {
    return this.bloodRequests.find((bloodRequest) => bloodRequest.id === id);
  }

  updateBloodRequest(id: number, partial: Partial<Omit<BloodRequestRecord, 'id' | 'createdAt' | 'updatedAt'>>): BloodRequestRecord | undefined {
    const bloodRequest = this.getBloodRequest(id);
    if (!bloodRequest) return undefined;
    Object.assign(bloodRequest, partial, { updatedAt: new Date() });
    return bloodRequest;
  }

  updateBloodRequestStatus(
    id: number,
    status: BloodRequestRecord['status'],
    donorId?: number | null,
  ): BloodRequestRecord | undefined {
    const bloodRequest = this.getBloodRequest(id);
    if (!bloodRequest) return undefined;

    const donor = donorId ? this.getDonor(donorId) : undefined;
    const now = new Date();

    bloodRequest.status = status;

    if (status === 'accepted' && donor) {
      bloodRequest.acceptedByDonorId = donor.id;
      bloodRequest.acceptedByDonorName = donor.fullName;
      bloodRequest.acceptedAt = now;
    }

    if (donor && !bloodRequest.acceptedByDonorId) {
      bloodRequest.acceptedByDonorId = donor.id;
      bloodRequest.acceptedByDonorName = donor.fullName;
    }

    if (status === 'donation_completed') {
      bloodRequest.completedAt = now;
      if (donor) {
        bloodRequest.fulfilledByDonorId = donor.id;
        bloodRequest.fulfilledByDonorName = donor.fullName;
      } else if (bloodRequest.acceptedByDonorId && !bloodRequest.fulfilledByDonorId) {
        bloodRequest.fulfilledByDonorId = bloodRequest.acceptedByDonorId;
        bloodRequest.fulfilledByDonorName = bloodRequest.acceptedByDonorName ?? undefined;
      }
    }

    bloodRequest.updatedAt = now;
    return bloodRequest;
  }

  getBloodDonationByRequestId(requestId: number): BloodDonationRecord | undefined {
    return this.bloodDonations.find((bloodDonation) => bloodDonation.requestId === requestId);
  }

  upsertBloodDonationForRequest(input: {
    requestId: number;
    donorId: number;
    donorName: string;
    bloodGroup: string;
    status: BloodDonationRecord['status'];
  }): BloodDonationRecord {
    const now = new Date();
    const existing = this.getBloodDonationByRequestId(input.requestId);

    if (existing) {
      existing.donorId = input.donorId;
      existing.donorName = input.donorName;
      existing.bloodGroup = input.bloodGroup;
      existing.status = input.status;
      existing.updatedAt = now;
      return existing;
    }

    const bloodDonation: BloodDonationRecord = {
      id: this.donationId++,
      requestId: input.requestId,
      donorId: input.donorId,
      donorName: input.donorName,
      bloodGroup: input.bloodGroup,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };
    this.bloodDonations.push(bloodDonation);
    return bloodDonation;
  }

  completeBloodRequest(id: number, donorId: number): BloodRequestRecord | undefined {
    const bloodRequest = this.updateBloodRequestStatus(id, 'donation_completed', donorId);
    if (!bloodRequest) {
      return undefined;
    }

    const donor = this.getDonor(donorId);
    if (donor) {
      this.upsertBloodDonationForRequest({
        requestId: bloodRequest.id,
        donorId: donor.id,
        donorName: donor.fullName,
        bloodGroup: bloodRequest.bloodGroup,
        status: 'completed',
      });
      // mark donor as recently donated / unavailable and record last donation date
      const now = new Date();
      donor.lastDonationDate = now.toISOString();
      donor.isAvailable = false;
      donor.availabilityStatus = 'Recently Donated';
      donor.updatedAt = now;
    }
    return bloodRequest;
  }

  listActiveBloodRequests(): BloodRequestRecord[] {
    return this.listBloodRequests().filter((bloodRequest) => bloodRequest.status === 'active');
  }

  listIncomingBloodRequestsForUser(userId: number): BloodRequestRecord[] {
    const donorIds = this.getAllMyDonors(userId)
      .filter((donor) => donor.isAvailable && donor.availabilityStatus === 'Available')
      .map((donor) => donor.id);

    return this.listBloodRequests()
      .filter((bloodRequest) => bloodRequest.status === 'request_pending' && bloodRequest.requestedToDonorId != null && donorIds.includes(bloodRequest.requestedToDonorId))
      .sort((left, right) => {
        if (left.urgency !== right.urgency) {
          return left.urgency === 'urgent' ? -1 : 1;
        }

        return right.createdAt.getTime() - left.createdAt.getTime();
      });
  }

  getIncomingBloodRequestForUser(userId: number, requestId: number): BloodRequestRecord | undefined {
    return this.listIncomingBloodRequestsForUser(userId).find((bloodRequest) => bloodRequest.id === requestId);
  }

  hasOpenBloodRequestForUser(userId: number): boolean {
    return this.bloodRequests.some(
      (bloodRequest) => bloodRequest.requesterUserId === userId && bloodRequest.status !== 'donation_completed',
    );
  }

  listUrgentBloodRequests(): BloodRequestRecord[] {
    return this.listActiveBloodRequests().filter((bloodRequest) => bloodRequest.urgency === 'urgent');
  }

  getActiveRequestsForBloodGroup(bloodGroup?: string): BloodRequestRecord[] {
    const activeRequests = this.listActiveBloodRequests();
    if (!bloodGroup) return activeRequests;
    return activeRequests.filter((bloodRequest) => bloodRequest.bloodGroup.toLowerCase() === bloodGroup.toLowerCase());
  }

  deleteBloodRequest(id: number): boolean {
    const index = this.bloodRequests.findIndex((bloodRequest) => bloodRequest.id === id);
    if (index === -1) return false;
    this.bloodRequests.splice(index, 1);
    return true;
  }

  scheduleBloodRequest(requestId: number, userId: number, scheduleDate: Date): BloodRequestRecord | undefined {
    const bloodRequest = this.getBloodRequest(requestId);
    if (!bloodRequest) return undefined;

    const donors = this.listDonors().filter((donor) => this.getDonorOwnerUserId(donor) === userId);
    const normalize = (s?: string | null) => (s ? s.replace(/\s+/g, '').toLowerCase() : '');
    const reqBg = normalize(bloodRequest.bloodGroup);
    const eligible = donors.filter((d) => {
      const bg = normalize(d.bloodGroup);
      const availability = d.availabilityStatus ? String(d.availabilityStatus).toLowerCase() : '';
      return d.isAvailable && availability === 'available' && bg && bg === reqBg;
    });

    if (!eligible.length) return undefined;

    const donor = eligible[0];
    const now = new Date();

    bloodRequest.acceptedByDonorId = donor.id;
    bloodRequest.acceptedByDonorName = donor.fullName;
    bloodRequest.acceptedAt = now;
    bloodRequest.scheduledDate = scheduleDate;
    bloodRequest.status = 'accepted';
    bloodRequest.updatedAt = now;

    return bloodRequest;
  }

  listBloodDonations(): BloodDonationRecord[] {
    return [...this.bloodDonations].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  addBloodDonation(
    input: Pick<BloodDonationRecord, 'donorId' | 'donorName' | 'bloodGroup'> & {
      requestId?: number | null;
      status?: BloodDonationRecord['status'];
    },
  ): BloodDonationRecord {
    const now = new Date();
    const bloodDonation: BloodDonationRecord = {
      id: this.donationId++,
      requestId: input.requestId ?? null,
      donorId: input.donorId,
      donorName: input.donorName,
      bloodGroup: input.bloodGroup,
      status: input.status ?? 'completed',
      createdAt: now,
      updatedAt: now,
    };
    this.bloodDonations.push(bloodDonation);
    return bloodDonation;
  }

  getBloodDonation(id: number): BloodDonationRecord | undefined {
    return this.bloodDonations.find((bloodDonation) => bloodDonation.id === id);
  }

  updateBloodDonation(id: number, partial: Partial<Omit<BloodDonationRecord, 'id' | 'createdAt' | 'updatedAt'>>): BloodDonationRecord | undefined {
    const bloodDonation = this.getBloodDonation(id);
    if (!bloodDonation) return undefined;
    const now = new Date();
    const prevStatus = bloodDonation.status;
    Object.assign(bloodDonation, partial, { updatedAt: now });

    // If donation moved to completed, mark donor as recently donated
    if (partial.status === 'completed' && prevStatus !== 'completed') {
      const donor = this.getDonor(bloodDonation.donorId);
      if (donor) {
        donor.lastDonationDate = now.toISOString();
        donor.isAvailable = false;
        donor.availabilityStatus = 'Recently Donated';
        donor.updatedAt = now;
      }
    }

    return bloodDonation;
  }

  deleteBloodDonation(id: number): boolean {
    const index = this.bloodDonations.findIndex((bloodDonation) => bloodDonation.id === id);
    if (index === -1) return false;
    this.bloodDonations.splice(index, 1);
    return true;
  }

  addNotification(input: {
    recipientRole: NotificationRecord['recipientRole'];
    recipientUserId: number;
    type: NotificationRecord['type'];
    title: string;
    message: string;
    entityType?: string | null;
    entityId?: number | null;
    metadata?: Record<string, unknown> | null;
  }): NotificationRecord {
    const now = new Date();
    const notification: NotificationRecord = {
      id: this.notifications.length + 1,
      recipientRole: input.recipientRole,
      recipientUserId: input.recipientUserId,
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
      isRead: false,
      readAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.notifications.push(notification);
    return notification;
  }

  listNotifications(recipientRole: NotificationRecord['recipientRole'], recipientUserId: number): NotificationRecord[] {
    return [...this.notifications]
      .filter((notification) => notification.recipientRole === recipientRole && notification.recipientUserId === recipientUserId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  getNotification(id: number): NotificationRecord | undefined {
    return this.notifications.find((notification) => notification.id === id);
  }

  markNotificationAsRead(id: number): NotificationRecord | undefined {
    const notification = this.getNotification(id);
    if (!notification) return undefined;
    notification.isRead = true;
    notification.readAt = new Date();
    notification.updatedAt = new Date();
    return notification;
  }

  markAllNotificationsAsRead(recipientRole: NotificationRecord['recipientRole'], recipientUserId: number): NotificationRecord[] {
    const now = new Date();
    return this.notifications
      .filter((notification) => notification.recipientRole === recipientRole && notification.recipientUserId === recipientUserId)
      .map((notification) => {
        notification.isRead = true;
        notification.readAt = now;
        notification.updatedAt = now;
        return notification;
      });
  }

  getUnreadNotificationCount(recipientRole: NotificationRecord['recipientRole'], recipientUserId: number): number {
    return this.notifications.filter(
      (notification) => notification.recipientRole === recipientRole && notification.recipientUserId === recipientUserId && !notification.isRead,
    ).length;
  }

  stats(): { donors: number; bloodRequests: number; donations: number } {
    return {
      donors: this.donors.length,
      bloodRequests: this.bloodRequests.length,
      donations: this.bloodDonations.length,
    };
  }

  getRelevantDonors(bloodGroup?: string): DonorRecord[] {
    return this.listDonors().filter((donor) => {
      if (!donor.isActive || !donor.isAvailable) return false;
      if (!bloodGroup) return true;
      return donor.bloodGroup?.toLowerCase() === bloodGroup.toLowerCase();
    });
  }

  // User management methods
  getUserByEmail(email: string): UserRecord | undefined {
    return this.users.find((user) => user.email === email);
  }

  getUserByMobileNumber(mobileNumber: string): UserRecord | undefined {
    return this.users.find((user) => user.mobileNumber === mobileNumber);
  }

  getUserById(id: number): UserRecord | undefined {
    return this.users.find((user) => user.id === id);
  }

  updateUserProfile(
    id: number,
    partial: Partial<Omit<UserRecord, 'id' | 'passwordHash' | 'role' | 'createdAt' | 'updatedAt'>>,
  ): UserRecord | undefined {
    const user = this.getUserById(id);
    if (!user) return undefined;

    Object.assign(user, partial, { updatedAt: new Date() });
    return user;
  }

  registerUser(input: {
    fullName: string;
    email: string;
    mobileNumber: string;
    dateOfBirth: string;
    weight: number;
    bloodGroup: string;
    lastBloodDonation?: string | null;
    passwordHash: string;
  }): UserRecord {
    const now = new Date();
    const user: UserRecord = {
      id: this.userId++,
      fullName: input.fullName,
      email: input.email,
      mobileNumber: input.mobileNumber,
      dateOfBirth: input.dateOfBirth,
      weight: input.weight,
      bloodGroup: input.bloodGroup,
      lastBloodDonation: input.lastBloodDonation ?? null,
      passwordHash: input.passwordHash,
      role: 'user',
      createdAt: now,
      updatedAt: now,
    };
    this.users.push(user);
    return user;
  }

  authenticateUser(email: string, password: string): UserRecord | undefined {
    const user = this.getUserByEmail(email);
    if (!user) return undefined;
    return bcrypt.compareSync(password, user.passwordHash) ? user : undefined;
  }

  updateUserPassword(email: string, newPasswordHash: string): UserRecord | undefined {
    const user = this.getUserByEmail(email);
    if (!user) return undefined;
    user.passwordHash = newPasswordHash;
    user.updatedAt = new Date();
    return user;
  }

  // Password reset methods
  generateResetToken(email: string, userType: 'superadmin' | 'donor' | 'user'): string {
    const token = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
    this.resetTokens.push({
      token,
      email,
      userType,
      expiresAt,
      used: false,
    });
    return token;
  }

  validateResetToken(token: string): ResetTokenRecord | undefined {
    const record = this.resetTokens.find((t) => t.token === token && !t.used && t.expiresAt > new Date());
    return record;
  }

  markResetTokenAsUsed(token: string): void {
    const record = this.resetTokens.find((t) => t.token === token);
    if (record) {
      record.used = true;
    }
  }

  resetPassword(token: string, newPasswordHash: string): { success: boolean; email?: string; userType?: string } {
    const record = this.validateResetToken(token);
    if (!record) {
      return { success: false };
    }

    const { email, userType } = record;

    if (userType === 'superadmin') {
      const superAdmin = this.getSuperAdminByEmail(email);
      if (superAdmin) {
        superAdmin.passwordHash = newPasswordHash;
        this.markResetTokenAsUsed(token);
        return { success: true, email, userType };
      }
    } else if (userType === 'donor') {
      const donor = this.getDonorByEmail(email);
      if (donor) {
        donor.passwordHash = newPasswordHash;
        this.markResetTokenAsUsed(token);
        return { success: true, email, userType };
      }
    } else if (userType === 'user') {
      const user = this.getUserByEmail(email);
      if (user) {
        user.passwordHash = newPasswordHash;
        this.markResetTokenAsUsed(token);
        return { success: true, email, userType };
      }
    }

    return { success: false };
  }
}