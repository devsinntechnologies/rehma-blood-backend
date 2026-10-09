import { ConflictException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorDto } from './dto/update-donor.dto';
import { UpdateDonorAvailabilityDto } from './dto/update-donor-availability.dto';
import { AppStorageService, toPublicDonor } from '../storage/app-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ParticipationLifecycleService } from '../blood-requests/participation-lifecycle.service';

@Injectable()
export class DonorsService {
  constructor(
    private readonly appStorageService: AppStorageService,
    private readonly notificationsService: NotificationsService,
    private readonly participationLifecycle: ParticipationLifecycleService,
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
    // Storage matches donors by email first, so a reused email would overwrite
    // someone else's donor profile instead of creating a new one.
    if (createDonorDto.email && this.appStorageService.getDonorByEmail(createDonorDto.email)) {
      throw new ConflictException('Donor with this email already exists');
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

    return { donor: toPublicDonor(donor), promoCode: promo, message: 'Donor profile created successfully' };
  }

  findAll(userId?: number, userRole?: string) {
    // Superadmin and user IDs share the same number space, so the role must be checked before the ID.
    if (userRole === 'superadmin') {
      return this.appStorageService.listDonors().map(toPublicDonor);
    }
    if (!userId) return [];

    return this.appStorageService.getDonorsByUserId(userId).map(toPublicDonor);
  }

  async findOne(id: number) {
    return toPublicDonor(this.getDonorOrThrow(id));
  }

  private getDonorOrThrow(id: number) {
    const donor = this.appStorageService.getDonor(id);
    if (!donor) {
      throw new NotFoundException(`Donor with ID ${id} not found`);
    }
    return donor;
  }

  async update(id: number, updateDonorDto: UpdateDonorDto, userId?: number, userRole?: string) {
    this.getDonorOrThrow(id);
    if (!this.canManageDonor(id, userId, userRole)) {
      throw new ForbiddenException('Only the donor owner or superadmin can update this donor');
    }
    if (updateDonorDto.isActive !== undefined && userRole !== 'superadmin') {
      throw new ForbiddenException('Only a Super Admin can activate or deactivate a donor');
    }
    if (updateDonorDto.email) {
      const sameEmail = this.appStorageService.getDonorByEmail(updateDonorDto.email);
      if (sameEmail && sameEmail.id !== id) {
        throw new ConflictException('Donor with this email already exists');
      }
    }
    if (updateDonorDto.phone) {
      const samePhone = this.appStorageService.getDonorByPhone(updateDonorDto.phone);
      if (samePhone && samePhone.id !== id) {
        throw new ConflictException('Donor with this phone number already exists');
      }
    }

    // isAvailable and availabilityStatus must agree (matching checks both).
    const changes: Partial<UpdateDonorDto> & { availabilityStatus?: 'Available' | 'Not Available' } = { ...updateDonorDto };
    if (updateDonorDto.isAvailable !== undefined) {
      changes.availabilityStatus = updateDonorDto.isAvailable ? 'Available' : 'Not Available';
    }

    const donor = this.appStorageService.updateDonor(id, changes);
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

    return toPublicDonor(donor);
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

    return { donor: toPublicDonor(updated), message: `Donor availability status updated to ${updateDto.availabilityStatus}` };
  }

  async remove(id: number, userId?: number, userRole?: string) {
    const donor = this.getDonorOrThrow(id);
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

    return result.map(toPublicDonor);
  }

  getIncomingRequests(userId: number) {
    return this.appStorageService.listIncomingBloodRequestsForUser(userId).map((bloodRequest) =>
      this.enrichIncomingRequest(bloodRequest, userId),
    );
  }

  private enrichIncomingRequest(
    bloodRequest: import('../storage/app-storage.service').BloodRequestRecord,
    userId: number,
  ) {
    const participation = this.findActionableParticipation(bloodRequest.id, bloodRequest.requestedToDonorId, userId);
    return {
      ...bloodRequest,
      participationId: participation?.id ?? null,
    };
  }

  private findActionableParticipation(requestId: number, donorId: number | null | undefined, userId: number) {
    const open = new Set(['invited', 'available_later']);
    return this.appStorageService
      .listParticipationsForRequest(requestId)
      .find(
        (p) =>
          open.has(p.status) &&
          (p.ownerUserId === userId || (donorId != null && p.donorId === donorId)),
      );
  }

  /** Requests one of the user's donors accepted or scheduled and still has to complete. */
  getAcceptedRequests(userId: number) {
    return this.appStorageService.listAcceptedBloodRequestsForUser(userId);
  }

  getMyCommitments(userId: number) {
    const participations = this.appStorageService.listActiveParticipationsForOwner(userId);
    return participations.map((p) => {
      const request = this.appStorageService.getBloodRequest(p.requestId);
      const donor = this.appStorageService.getDonor(p.donorId);
      return {
        participation: p,
        bloodRequest: request ?? null,
        donor: donor ? { id: donor.id, fullName: donor.fullName, bloodGroup: donor.bloodGroup } : null,
        actingForManagedDonor:
          donor != null &&
          donor.createdByUserId === userId &&
          donor.userId !== userId &&
          donor.linkedUserId !== userId,
      };
    });
  }

  getIncomingRequestById(userId: number, requestId: number) {
    // Waiting for one of the user's donors, or already taken on by one of them
    // (the donor still needs the requester's details until it is completed).
    const bloodRequest =
      this.appStorageService.getIncomingBloodRequestForUser(userId, requestId) ??
      this.appStorageService.listAcceptedBloodRequestsForUser(userId).find((request) => request.id === requestId);
    if (!bloodRequest) {
      throw new NotFoundException(`Incoming blood request with ID ${requestId} not found`);
    }

    const donor = bloodRequest.requestedToDonorId ? this.appStorageService.getDonor(bloodRequest.requestedToDonorId) : null;
    const requester = bloodRequest.requesterUserId ? this.appStorageService.getUserById(bloodRequest.requesterUserId) : null;

    const participation = this.findActionableParticipation(
      bloodRequest.id,
      bloodRequest.requestedToDonorId,
      userId,
    );

    return {
      bloodRequest: {
        ...bloodRequest,
        participationId: participation?.id ?? null,
      },
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

  async declineIncomingRequest(userId: number, requestId: number, idempotencyKey?: string) {
    const bloodRequest = this.appStorageService.getIncomingBloodRequestForUser(userId, requestId);
    if (!bloodRequest) {
      throw new NotFoundException(`Incoming blood request with ID ${requestId} not found`);
    }

    const donor = bloodRequest.requestedToDonorId
      ? this.appStorageService.getDonor(bloodRequest.requestedToDonorId)
      : undefined;
    if (!donor) {
      throw new NotFoundException('Requested donor profile not found');
    }

    let participation = this.appStorageService
      .listParticipationsForRequest(requestId)
      .find((p) => p.donorId === donor.id && ['invited', 'available_later'].includes(p.status));

    if (!participation) {
      const ownerUserId = this.appStorageService.getDonorOwnerUserId(donor) ?? userId;
      const windowMs = bloodRequest.urgency === 'urgent' ? 45 * 60_000 : 4 * 60 * 60_000;
      participation = this.participationLifecycle.createInviteParticipation(
        bloodRequest,
        donor.id,
        ownerUserId,
        new Date(Date.now() + windowMs),
      );
    }

    const result = await this.participationLifecycle.respond(
      participation.id,
      { userId, role: 'user' },
      { response: 'cannot_help' },
      idempotencyKey,
    );

    const updated = this.appStorageService.getBloodRequest(requestId)!;
    return {
      bloodRequest: { ...updated, participationId: null },
      message: 'Incoming request declined',
      participation: result.body,
    };
  }

  async acceptIncomingRequest(
    userId: number,
    requestId: number,
    idempotencyKey?: string,
    unitsCommitted?: number,
  ) {
    const bloodRequest = this.appStorageService.getIncomingBloodRequestForUser(userId, requestId);
    if (!bloodRequest) {
      throw new NotFoundException(`Incoming blood request with ID ${requestId} not found`);
    }

    const donor = bloodRequest.requestedToDonorId ? this.appStorageService.getDonor(bloodRequest.requestedToDonorId) : undefined;
    if (!donor) {
      throw new NotFoundException('Requested donor profile not found');
    }

    let participation = this.appStorageService
      .listParticipationsForRequest(requestId)
      .find((p) => p.donorId === donor.id && ['invited', 'available_later'].includes(p.status));

    if (!participation) {
      const ownerUserId = this.appStorageService.getDonorOwnerUserId(donor) ?? userId;
      const windowMs =
        bloodRequest.urgency === 'urgent' ? 45 * 60_000 : 4 * 60 * 60_000;
      participation = this.participationLifecycle.createInviteParticipation(
        bloodRequest,
        donor.id,
        ownerUserId,
        new Date(Date.now() + windowMs),
      );
    }

    const units = Math.max(1, Math.min(10, Math.floor(unitsCommitted ?? 1)));
    const result = await this.participationLifecycle.respond(
      participation.id,
      { userId, role: 'user' },
      { response: 'can_help', unitsCommitted: units },
      idempotencyKey,
    );

    const accepted = this.appStorageService.getBloodRequest(requestId)!;
    const donation = this.appStorageService.upsertBloodDonationForRequest({
      requestId: accepted.id,
      donorId: donor.id,
      donorName: donor.fullName,
      bloodGroup: accepted.bloodGroup,
      status: 'donation_pending',
    });

    const requester = accepted.requesterUserId ? this.appStorageService.getUserById(accepted.requesterUserId) : null;

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
      participation: result.body,
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

    return { donor: toPublicDonor(donor), message: 'Promo code disabled' };
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

    return { ...result, donor: toPublicDonor(result.donor) };
  }

  getPromoCodeInfo(id: number, userId?: number, userRole?: string) {
    const donor = this.appStorageService.getDonor(id);
    if (!donor) {
      throw new NotFoundException(`Donor with ID ${id} not found`);
    }
    if (!this.canManageDonor(id, userId, userRole)) {
      throw new ForbiddenException("Only the donor's owner or a Super Admin can see its promo code");
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
