import { ConflictException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorDto } from './dto/update-donor.dto';
import { UpdateDonorAvailabilityDto } from './dto/update-donor-availability.dto';
import { AppStorageService } from '../storage/app-storage.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DonorsService {
  constructor(
    private readonly appStorageService: AppStorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private canManageDonor(donorId: number, userId?: number, userRole?: string): boolean {
    if (userRole === 'superadmin') {
      return true;
    }

    const donor = this.appStorageService.getDonor(donorId);
    if (!donor || userId == null) {
      return false;
    }

    return this.appStorageService.getDonorOwnerUserId(donor) === userId;
  }

  create(createDonorDto: CreateDonorDto, createdByUserId?: number) {
    // Check if a donor with this phone already exists
    if (createDonorDto.phone) {
      const existingDonor = this.appStorageService.getDonorByPhone(createDonorDto.phone);
      if (existingDonor) {
        throw new ConflictException('Donor with this phone number already exists');
      }
    }

    // generate a collision-safe promo code
    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const part = Array.from({ length: 6 })
        .map(() => chars[Math.floor(Math.random() * chars.length)])
        .join('');
      return `RB-${part}`;
    };

    let promo = generateCode();
    let attempts = 0;
    while (this.appStorageService.getDonorByPromoCode(promo) && attempts < 10) {
      promo = generateCode();
      attempts += 1;
    }

    const donor = this.appStorageService.addDonor({
      ...createDonorDto,
      promoCode: promo,
      createdByUserId: createdByUserId ?? null,
      isVerifiedAccount: false,
    });

    this.notificationsService.notifySuperAdmins({
      type: 'donor_created',
      title: 'New donor created',
      message: `A donor profile for ${donor.fullName} was created.`,
      entityType: 'donor',
      entityId: donor.id,
      metadata: { donor, promoCode: promo },
    });

    return { donor, promoCode: promo, message: 'Donor profile created successfully' };
  }

  findAll(userId?: number) {
    const donors = this.appStorageService.listDonors();
    if (!userId) return donors;

    return donors.filter((donor) => this.appStorageService.getDonorOwnerUserId(donor) !== userId);
  }

  async findOne(id: number) {
    const donor = this.appStorageService.getDonor(id);
    if (!donor) {
      throw new NotFoundException(`Donor with ID ${id} not found`);
    }
    return donor;
  }

  async update(id: number, updateDonorDto: UpdateDonorDto, userId?: number, userRole?: string) {
    await this.findOne(id);
    if (!this.canManageDonor(id, userId, userRole)) {
      throw new ForbiddenException('Only the donor owner or superadmin can update this donor');
    }

    const donor = this.appStorageService.updateDonor(id, updateDonorDto);
    if (!donor) {
      throw new NotFoundException(`Donor with ID ${id} not found`);
    }

    this.notificationsService.notifySuperAdmins({
      type: 'donor_updated',
      title: 'Donor profile updated',
      message: `Donor #${donor.id} was updated.`,
      entityType: 'donor',
      entityId: donor.id,
      metadata: { donor },
    });

    if (userId != null && userRole) {
      this.notificationsService.create({
        recipient: { role: userRole as 'superadmin' | 'donor' | 'user', userId },
        type: 'donor_updated',
        title: 'Your donor profile changed',
        message: `Your donor profile #${donor.id} was updated.`,
        entityType: 'donor',
        entityId: donor.id,
        metadata: { donor },
      });
    }

    return donor;
  }

  updateAvailability(id: number, isAvailable: boolean) {
    const donor = this.appStorageService.updateDonorAvailability(id, isAvailable);
    if (!donor) {
      throw new NotFoundException(`Donor with ID ${id} not found`);
    }
    return donor;
  }

  updateLocation(id: number, latitude: number, longitude: number) {
    const donor = this.appStorageService.updateDonorLocation(id, latitude, longitude);
    if (!donor) {
      throw new NotFoundException(`Donor with ID ${id} not found`);
    }
    return donor;
  }

  updateAvailabilityStatus(id: number, updateDto: UpdateDonorAvailabilityDto, userId?: number, userRole?: string) {
    const donor = this.appStorageService.getDonor(id);
    if (!donor) {
      throw new NotFoundException(`Donor with ID ${id} not found`);
    }

    if (!this.canManageDonor(id, userId, userRole)) {
      throw new ForbiddenException('Only the donor owner or superadmin can update availability status');
    }

    const updated = this.appStorageService.updateDonorAvailabilityStatus(id, updateDto.availabilityStatus);
    if (!updated) {
      throw new NotFoundException(`Donor with ID ${id} not found`);
    }

    this.notificationsService.notifySuperAdmins({
      type: 'donor_status_changed',
      title: 'Donor availability changed',
      message: `Donor #${updated.id} status changed to ${updateDto.availabilityStatus}.`,
      entityType: 'donor',
      entityId: updated.id,
      metadata: { donor: updated },
    });

    if (userId != null && userRole) {
      this.notificationsService.create({
        recipient: { role: userRole as 'superadmin' | 'donor' | 'user', userId },
        type: 'donor_status_changed',
        title: 'Donor availability updated',
        message: `Donor #${updated.id} availability is now ${updateDto.availabilityStatus}.`,
        entityType: 'donor',
        entityId: updated.id,
        metadata: { donor: updated },
      });
    }

    return { donor: updated, message: `Donor availability status updated to ${updateDto.availabilityStatus}` };
  }

  async remove(id: number, userId?: number, userRole?: string) {
    const donor = await this.findOne(id);
    if (!this.canManageDonor(id, userId, userRole)) {
      throw new ForbiddenException('Only the donor owner or superadmin can delete this donor');
    }

    this.appStorageService.deleteDonor(id);

    this.notificationsService.notifySuperAdmins({
      type: 'donor_updated',
      title: 'Donor deleted',
      message: `Donor #${id} was deleted.`,
      entityType: 'donor',
      entityId: id,
      metadata: { donorId: id },
    });

    if (userId != null && userRole) {
      this.notificationsService.create({
        recipient: { role: userRole as 'superadmin' | 'donor' | 'user', userId },
        type: 'donor_updated',
        title: 'Donor profile deleted',
        message: `Donor #${donor.id} was deleted.`,
        entityType: 'donor',
        entityId: donor.id,
        metadata: { donorId: donor.id },
      });
    }

    return { message: `Donor with ID ${id} deleted` };
  }

  getCreatedDonors(userId: number) {
    const allDonors = this.appStorageService.getAllMyDonors(userId);
    // Merge only real duplicate phone numbers; keep phone-less donors as separate records.
    const donorsByPhone = new Map<string, typeof allDonors[number]>();
    const result: typeof allDonors = [];

    for (const donor of allDonors) {
      const phone = donor.phone?.trim();
      if (!phone) {
        result.push(donor);
        continue;
      }

      if (!donorsByPhone.has(phone)) {
        donorsByPhone.set(phone, donor);
        result.push(donor);
      }
    }

    return result;
  }

  getIncomingRequests(userId: number) {
    return this.appStorageService.listIncomingBloodRequestsForUser(userId);
  }

  getIncomingRequestById(userId: number, requestId: number) {
    const bloodRequest = this.appStorageService.getIncomingBloodRequestForUser(userId, requestId);
    if (!bloodRequest) {
      throw new NotFoundException(`Incoming blood request with ID ${requestId} not found`);
    }

    const donor = bloodRequest.requestedToDonorId ? this.appStorageService.getDonor(bloodRequest.requestedToDonorId) : null;
    const requester = bloodRequest.requesterUserId ? this.appStorageService.getUserById(bloodRequest.requesterUserId) : null;

    return {
      bloodRequest,
      donor: donor
        ? {
            id: donor.id,
            fullName: donor.fullName,
            bloodGroup: donor.bloodGroup,
            phone: donor.phone,
            email: donor.email,
            availabilityStatus: donor.availabilityStatus,
          }
        : null,
      requester: requester
        ? {
            id: requester.id,
            fullName: requester.fullName,
            email: requester.email,
            mobileNumber: requester.mobileNumber,
          }
        : null,
    };
  }

  acceptIncomingRequest(userId: number, requestId: number) {
    const bloodRequest = this.appStorageService.getIncomingBloodRequestForUser(userId, requestId);
    if (!bloodRequest) {
      throw new NotFoundException(`Incoming blood request with ID ${requestId} not found`);
    }

    const donor = bloodRequest.requestedToDonorId ? this.appStorageService.getDonor(bloodRequest.requestedToDonorId) : undefined;
    if (!donor) {
      throw new NotFoundException('Requested donor profile not found');
    }

    const accepted = this.appStorageService.updateBloodRequest(bloodRequest.id, {
      status: 'request_accepted',
      acceptedByDonorId: donor.id,
      acceptedByDonorName: donor.fullName,
      acceptedAt: new Date(),
    });

    if (!accepted) {
      throw new NotFoundException(`Blood request with ID ${requestId} not found`);
    }

    const donation = this.appStorageService.upsertBloodDonationForRequest({
      requestId: accepted.id,
      donorId: donor.id,
      donorName: donor.fullName,
      bloodGroup: accepted.bloodGroup,
      status: 'donation_pending',
    });

    const requester = accepted.requesterUserId ? this.appStorageService.getUserById(accepted.requesterUserId) : null;

    if (accepted.requesterUserId != null) {
      this.notificationsService.create({
        recipient: { role: 'user', userId: accepted.requesterUserId },
        type: 'blood_request_updated',
        title: 'Blood request accepted',
        message: `Your blood request #${accepted.id} was accepted by donor ${donor.fullName}.`,
        entityType: 'blood_request',
        entityId: accepted.id,
        metadata: { bloodRequest: accepted, donor, donation, requester },
      });
    }

    return {
      bloodRequest: accepted,
      donor: {
        id: donor.id,
        fullName: donor.fullName,
        bloodGroup: donor.bloodGroup,
        phone: donor.phone,
        email: donor.email,
        availabilityStatus: donor.availabilityStatus,
      },
      requester: requester
        ? {
            id: requester.id,
            fullName: requester.fullName,
            email: requester.email,
            mobileNumber: requester.mobileNumber,
          }
        : null,
      bloodDonation: donation,
      message: 'Incoming request accepted',
    };
  }

  disablePromoCode(id: number) {
    const donor = this.appStorageService.disablePromoCode(id);
    if (!donor) {
      throw new NotFoundException(`Donor with ID ${id} not found`);
    }

    this.notificationsService.notifySuperAdmins({
      type: 'promo_updated',
      title: 'Promo code disabled',
      message: `Promo code for donor #${donor.id} was disabled.`,
      entityType: 'donor',
      entityId: donor.id,
      metadata: { donor },
    });

    return { donor, message: 'Promo code disabled' };
  }

  regeneratePromoCode(id: number) {
    const result = this.appStorageService.regeneratePromoCode(id);
    if (!result) {
      throw new NotFoundException(`Donor with ID ${id} not found`);
    }

    this.notificationsService.notifySuperAdmins({
      type: 'promo_updated',
      title: 'Promo code regenerated',
      message: `A new promo code was generated for donor #${result.donor.id}.`,
      entityType: 'donor',
      entityId: result.donor.id,
      metadata: { donor: result.donor, newPromoCode: result.newPromoCode },
    });

    return result;
  }

  getPromoCodeInfo(id: number) {
    const donor = this.appStorageService.getDonor(id);
    if (!donor) {
      throw new NotFoundException(`Donor with ID ${id} not found`);
    }
    return {
      donorId: donor.id,
      promoCode: donor.promoCode,
      isClaimed: donor.isClaimed,
      claimStatus: donor.claimStatus,
      claimedByUserId: donor.claimedByUserId,
      claimedAt: donor.claimedAt,
    };
  }
}
