import { Injectable, OnModuleInit } from '@nestjs/common';
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
  bloodGroup?: string | null;
  passwordHash?: string | null;
  isActive: boolean;
  isAvailable: boolean;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BloodRequestRecord = {
  id: number;
  requesterName?: string | null;
  requesterContact?: string | null;
  bloodGroup: string;
  requiredUnits: number;
  urgency: 'urgent' | 'normal';
  notes?: string | null;
  latitude: number;
  longitude: number;
  status: 'active' | 'completed';
  completedAt?: Date | null;
  fulfilledByDonorId?: number | null;
  fulfilledByDonorName?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BloodDonationRecord = {
  id: number;
  donorName: string;
  bloodGroup: string;
  status: string;
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
  lastBloodDonation: string;
  passwordHash: string;
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

  getDonorByEmail(email: string): DonorRecord | undefined {
    return this.donors.find((donor) => donor.email === email);
  }

  addOrUpdateDonor(input: {
    fullName: string;
    email?: string | null;
    phone?: string | null;
    bloodGroup?: string | null;
    passwordHash?: string | null;
    isAvailable?: boolean;
    latitude?: number | null;
    longitude?: number | null;
  }): DonorRecord {
    const existingDonor = input.email ? this.getDonorByEmail(input.email) : undefined;
    const now = new Date();

    if (existingDonor) {
      Object.assign(existingDonor, {
        fullName: input.fullName,
        phone: input.phone ?? existingDonor.phone ?? null,
        bloodGroup: input.bloodGroup ?? existingDonor.bloodGroup ?? null,
        passwordHash: input.passwordHash ?? existingDonor.passwordHash ?? null,
        isAvailable: input.isAvailable ?? existingDonor.isAvailable,
        latitude: input.latitude ?? existingDonor.latitude ?? null,
        longitude: input.longitude ?? existingDonor.longitude ?? null,
        updatedAt: now,
      });
      return existingDonor;
    }

    const donor: DonorRecord = {
      id: this.donorId++,
      fullName: input.fullName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      bloodGroup: input.bloodGroup ?? null,
      passwordHash: input.passwordHash ?? null,
      isActive: true,
      isAvailable: input.isAvailable ?? true,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
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
    });
  }

  listDonors(): DonorRecord[] {
    return [...this.donors].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  addDonor(
    input: Pick<DonorRecord, 'fullName' | 'email' | 'phone' | 'bloodGroup' | 'latitude' | 'longitude'> & {
      isAvailable?: boolean;
    },
  ): DonorRecord {
    return this.addOrUpdateDonor(input);
  }

  getDonor(id: number): DonorRecord | undefined {
    return this.donors.find((donor) => donor.id === id);
  }

  updateDonor(id: number, partial: Partial<Omit<DonorRecord, 'id' | 'createdAt' | 'updatedAt'>>): DonorRecord | undefined {
    const donor = this.getDonor(id);
    if (!donor) return undefined;
    Object.assign(donor, partial, { updatedAt: new Date() });
    return donor;
  }

  updateDonorAvailability(id: number, isAvailable: boolean): DonorRecord | undefined {
    return this.updateDonor(id, { isAvailable });
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

  addBloodRequest(input: {
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
      requesterName: input.requesterName ?? null,
      requesterContact: input.requesterContact ?? null,
      bloodGroup: input.bloodGroup,
      requiredUnits: input.requiredUnits,
      urgency: input.urgency,
      notes: input.notes ?? null,
      latitude: input.latitude,
      longitude: input.longitude,
      status: 'active',
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

  completeBloodRequest(id: number, donorId: number): BloodRequestRecord | undefined {
    const bloodRequest = this.getBloodRequest(id);
    const donor = this.getDonor(donorId);

    if (!bloodRequest || !donor) {
      return undefined;
    }

    bloodRequest.status = 'completed';
    bloodRequest.completedAt = new Date();
    bloodRequest.fulfilledByDonorId = donor.id;
    bloodRequest.fulfilledByDonorName = donor.fullName;
    bloodRequest.updatedAt = new Date();

    this.addBloodDonation({ donorName: donor.fullName, bloodGroup: bloodRequest.bloodGroup });
    return bloodRequest;
  }

  listActiveBloodRequests(): BloodRequestRecord[] {
    return this.listBloodRequests().filter((bloodRequest) => bloodRequest.status === 'active');
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

  listBloodDonations(): BloodDonationRecord[] {
    return [...this.bloodDonations].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  addBloodDonation(input: Pick<BloodDonationRecord, 'donorName' | 'bloodGroup'>): BloodDonationRecord {
    const now = new Date();
    const bloodDonation: BloodDonationRecord = {
      id: this.donationId++,
      donorName: input.donorName,
      bloodGroup: input.bloodGroup,
      status: 'completed',
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
    Object.assign(bloodDonation, partial, { updatedAt: new Date() });
    return bloodDonation;
  }

  deleteBloodDonation(id: number): boolean {
    const index = this.bloodDonations.findIndex((bloodDonation) => bloodDonation.id === id);
    if (index === -1) return false;
    this.bloodDonations.splice(index, 1);
    return true;
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

  getUserById(id: number): UserRecord | undefined {
    return this.users.find((user) => user.id === id);
  }

  registerUser(input: {
    fullName: string;
    email: string;
    mobileNumber: string;
    dateOfBirth: string;
    weight: number;
    bloodGroup: string;
    lastBloodDonation: string;
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
      lastBloodDonation: input.lastBloodDonation,
      passwordHash: input.passwordHash,
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