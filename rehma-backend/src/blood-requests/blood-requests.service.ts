import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { UpdateBloodRequestDto } from './dto/update-blood-request.dto';
import { AppStorageService, IN_PROGRESS_REQUEST_STATUSES } from '../storage/app-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ParticipationLifecycleService } from './participation-lifecycle.service';
import { summarizeRequestUnits } from './unit-accounting.service';

@Injectable()
export class BloodRequestsService {
  constructor(
    private readonly appStorageService: AppStorageService,
    private readonly notificationsService: NotificationsService,
    private readonly participationLifecycle: ParticipationLifecycleService,
  ) {}

  create(createBloodRequestDto: CreateBloodRequestDto, userId?: number) {
    if (userId) {
      if (this.appStorageService.hasOpenBloodRequestForUser(userId)) {
        throw new ForbiddenException('You already have an open blood request. Complete it before creating a new one');
      }
    }

    const bloodRequest = this.appStorageService.addBloodRequest({
      ...createBloodRequestDto,
      requesterUserId: userId ?? null,
      deadlineAt: createBloodRequestDto.deadlineAt
        ? new Date(createBloodRequestDto.deadlineAt)
        : null,
    });

    const message = `New ${bloodRequest.urgency} blood request for ${bloodRequest.bloodGroup} has been created`;
    this.notificationsService.notifySuperAdmins({
      type: 'blood_request_created',
      title: 'New blood request created',
      message,
      entityType: 'blood_request',
      entityId: bloodRequest.id,
      metadata: {
        bloodRequest,
      },
    });

    if (bloodRequest.requesterUserId) {
      this.notificationsService.create({
        recipient: { role: 'user', userId: bloodRequest.requesterUserId },
        type: 'blood_request_created',
        title: 'Blood request received',
        message: `Your blood request for ${bloodRequest.bloodGroup} has been created successfully.`,
        entityType: 'blood_request',
        entityId: bloodRequest.id,
        metadata: { bloodRequest },
      });
    }

    return bloodRequest;
  }

  findAll(excludeUserId?: number) {
    const all = this.appStorageService.listBloodRequests().filter((br) => {
      if (!excludeUserId) return true;
      return br.requesterUserId !== excludeUserId;
    });

    return all.sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === 'active' ? -1 : 1;
      }

      if (left.urgency !== right.urgency) {
        return left.urgency === 'urgent' ? -1 : 1;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    });
  }

  findMyRequests(userId: number) {
    return this.appStorageService.listBloodRequestsByRequesterUserId(userId);
  }

  findMyScheduledRequests(userId: number) {
    const scheduled = this.appStorageService.listScheduledBloodRequestsByRequesterUserId(userId);

    return scheduled.map((bloodRequest) => {
      const donor = bloodRequest.acceptedByDonorId
        ? this.appStorageService.getDonor(bloodRequest.acceptedByDonorId)
        : undefined;

      const requester = bloodRequest.requesterUserId
        ? this.appStorageService.getUserById(bloodRequest.requesterUserId)
        : null;

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
              city: donor.city,
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
    });
  }

  findAllScheduledDonations() {
    const scheduled = this.appStorageService.listAllScheduledBloodRequests();

    return scheduled.map((bloodRequest) => {
      const donor = bloodRequest.acceptedByDonorId
        ? this.appStorageService.getDonor(bloodRequest.acceptedByDonorId)
        : undefined;

      const requester = bloodRequest.requesterUserId
        ? this.appStorageService.getUserById(bloodRequest.requesterUserId)
        : null;

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
              city: donor.city,
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
    });
  }

  async findOne(id: number) {
    const bloodRequest = this.appStorageService.getBloodRequest(id);
    if (!bloodRequest) {
      throw new NotFoundException(`Blood request with ID ${id} not found`);
    }
    return bloodRequest;
  }

  findActive() {
    return this.appStorageService.listActiveBloodRequests();
  }

  findUrgent() {
    return this.appStorageService.listUrgentBloodRequests();
  }

  async update(id: number, updateBloodRequestDto: UpdateBloodRequestDto, userRole?: string) {
    if (userRole !== 'superadmin') {
      throw new ForbiddenException('Only a Super Admin can edit a blood request');
    }
    await this.findOne(id);
    const guarded = ['status', 'acceptedByDonorId', 'acceptedByDonorName', 'acceptedAt', 'fulfilledByDonorId', 'received'];
    for (const field of guarded) {
      if ((updateBloodRequestDto as Record<string, unknown>)[field] !== undefined) {
        throw new ForbiddenException(
          `Use admin transition or participation endpoints to change ${field}, not PATCH /blood-requests/:id`,
        );
      }
    }
    const bloodRequest = this.appStorageService.updateBloodRequest(id, updateBloodRequestDto);
    if (!bloodRequest) {
      throw new NotFoundException(`Blood request with ID ${id} not found`);
    }

    this.notificationsService.notifySuperAdmins({
      type: 'blood_request_updated',
      title: 'Blood request updated',
      message: `Blood request #${bloodRequest.id} was updated.`,
      entityType: 'blood_request',
      entityId: bloodRequest.id,
      metadata: { bloodRequest },
    });

    if (bloodRequest.requesterUserId) {
      this.notificationsService.create({
        recipient: { role: 'user', userId: bloodRequest.requesterUserId },
        type: 'blood_request_updated',
        title: 'Blood request updated',
        message: `Your blood request #${bloodRequest.id} has been updated.`,
        entityType: 'blood_request',
        entityId: bloodRequest.id,
        metadata: { bloodRequest },
      });
    }

    return bloodRequest;
  }

  /**
   * The donor (or the user who manages that donor) marks the donation as done.
   * Only a request a donor has accepted or scheduled can be completed, and the
   * donation is always credited to that donor, never to an id from the client.
   */
  async complete(
    id: number,
    userId: number,
    userRole?: string,
    idempotencyKey?: string,
  ): Promise<import('../storage/app-storage.service').BloodRequestRecord | undefined> {
    const existing = this.appStorageService.getBloodRequest(id);
    if (!existing) {
      throw new NotFoundException(`Blood request with ID ${id} not found`);
    }

    const participations = this.appStorageService.listParticipationsForRequest(id);
    const activeParticipations = participations.filter((p) =>
      ['accepted', 'scheduled'].includes(p.status),
    );
    const ownedActive = activeParticipations.find((p) => {
      if (userRole === 'superadmin') return p.donorId === existing.acceptedByDonorId;
      const donor = this.appStorageService.getDonor(p.donorId);
      return donor && this.appStorageService.getDonorOwnerUserId(donor) === userId;
    });

    if (!ownedActive && activeParticipations.length > 0 && userRole !== 'superadmin') {
      throw new ForbiddenException('Only the donor who accepted this request can complete it');
    }

    if (ownedActive) {
      const remaining = Math.max(1, ownedActive.unitsCommitted - ownedActive.unitsReported);
      const report = await this.participationLifecycle.reportDonation(
        ownedActive.id,
        { userId, role: userRole === 'superadmin' ? 'superadmin' : 'user' },
        remaining,
        idempotencyKey,
      );
      const payload = report.body as { request?: import('../storage/app-storage.service').BloodRequestRecord };
      return payload.request ?? this.appStorageService.getBloodRequest(id);
    }

    if (existing.requiredUnits > 1) {
      throw new ConflictException(
        'Use POST /participations/:id/report-donation with explicit units for multi-unit requests',
      );
    }

    if (!IN_PROGRESS_REQUEST_STATUSES.includes(existing.status) || existing.acceptedByDonorId == null) {
      throw new ConflictException('Only a request a donor has accepted or scheduled can be completed');
    }
    throw new ConflictException(
      'No active participation found — use participation report endpoint (client upgrade required)',
    );
  }

  /**
   * The requester confirms (or denies) receiving the blood. Only possible once
   * the donor has completed the donation, and only once.
   */
  async confirmReceipt(
    id: number,
    received: boolean,
    requesterId: number,
    unitsReceived?: number,
    participationId?: number,
    idempotencyKey?: string,
  ) {
    const bloodRequest = this.appStorageService.getBloodRequest(id);
    if (!bloodRequest) {
      throw new NotFoundException(`Blood request with ID ${id} not found`);
    }
    if (bloodRequest.requesterUserId !== requesterId) {
      throw new ForbiddenException('Only the requester can confirm receipt');
    }

    if (bloodRequest.requiredUnits > 1 && participationId == null) {
      throw new ConflictException(
        'Multi-unit requests require participationId and unitsReceived — use POST /participations/:id/confirm-receipt',
      );
    }

    const participations = this.appStorageService.listParticipationsForRequest(id);
    const target =
      (participationId != null ? participations.find((p) => p.id === participationId) : undefined) ??
      participations.find((p) => ['reported', 'partially_confirmed'].includes(p.status));

    if (target) {
      if (!received) {
        throw new ConflictException('Use dispute flow for reported donations that were not received');
      }
      const units = Math.max(1, unitsReceived ?? target.unitsReported - target.unitsConfirmed);
      const result = await this.participationLifecycle.confirmReceipt(
        target.id,
        { userId: requesterId, role: 'user' },
        units,
        idempotencyKey,
      );
      const payload = result.body as { request?: import('../storage/app-storage.service').BloodRequestRecord };
      return payload.request ?? this.appStorageService.getBloodRequest(id);
    }

    if (bloodRequest.status !== 'donation_completed') {
      throw new ConflictException('The donor has not completed this donation yet');
    }
    if (bloodRequest.received) {
      throw new ConflictException('Receipt has already been confirmed for this request');
    }

    if (received) {
      return this.appStorageService.updateBloodRequest(id, { received: true, receivedAt: new Date() });
    }

    this.appStorageService.updateBloodRequestStatus(id, 'active');
    return this.appStorageService.updateBloodRequest(id, {
      received: false,
      receivedAt: null,
      requestedToDonorId: null,
      requestedToDonorName: null,
      acceptedByDonorId: null,
      acceptedByDonorName: null,
      acceptedAt: null,
      scheduledDate: null,
      completedAt: null,
      fulfilledByDonorId: null,
      fulfilledByDonorName: null,
    });
  }

  matchToUserDonor(id: number, userId: number) {
    const bloodRequest = this.appStorageService.getBloodRequest(id);
    if (!bloodRequest) {
      throw new NotFoundException(`Blood request with ID ${id} not found`);
    }

    const donors = this.appStorageService.getDonorsByUserId(userId || 0);
    const availableDonors = donors.filter((d) => d.isAvailable && d.availabilityStatus === 'Available' && d.bloodGroup);
    const matchingDonors = availableDonors.filter(
      (d) => d.isAvailable && d.availabilityStatus === 'Available' && d.bloodGroup && d.bloodGroup.toLowerCase() === bloodRequest.bloodGroup.toLowerCase(),
    );

    return {
      requestId: bloodRequest.id,
      requestBloodGroup: bloodRequest.bloodGroup,
      hasMatchingAvailableDonor: matchingDonors.length > 0,
      totalAvailableDonors: availableDonors.length,
      totalMatchingDonors: matchingDonors.length,
      matchingDonors: matchingDonors.map((d) => ({
        id: d.id,
        fullName: d.fullName,
        bloodGroup: d.bloodGroup,
        availabilityStatus: d.availabilityStatus,
      })),
    };
  }

  /**
   * Sends the request to one donor: [targetDonorId] when the requester chose a
   * specific donor, otherwise the first matching Available donor.
   */
  requestAnyAvailableDonor(id: number, requesterUserId: number, targetDonorId?: number) {
    const bloodRequest = this.appStorageService.getBloodRequest(id);
    if (!bloodRequest) {
      throw new NotFoundException(`Blood request with ID ${id} not found`);
    }

    if (bloodRequest.requesterUserId != null && bloodRequest.requesterUserId !== requesterUserId) {
      throw new ForbiddenException('You can only request donors for your own blood request');
    }

    if (bloodRequest.status !== 'active' && bloodRequest.status !== 'request_pending') {
      throw new ForbiddenException('Only active or pending blood requests can be requested');
    }
    if (!this.appStorageService.isRequestAcceptingNewCommitments(bloodRequest)) {
      throw new ConflictException('This request is not accepting new invitations');
    }

    const maxOutstanding = Number(process.env.INVITE_MAX_OUTSTANDING ?? 3);
    const outstanding = this.appStorageService
      .listParticipationsForRequest(id)
      .filter((p) => p.status === 'invited').length;
    if (outstanding >= maxOutstanding) {
      throw new ConflictException('Maximum outstanding invitations reached for this request');
    }

    const matchingDonors = this.appStorageService
      .listDonors()
      .filter((donor) => {
        const donorOwnerUserId = this.appStorageService.getDonorOwnerUserId(donor);
        const ownerUserId = donorOwnerUserId ?? donor.createdByUserId ?? null;
        return (
          ownerUserId != null &&
          ownerUserId !== requesterUserId &&
          donor.isActive &&
          donor.isAvailable &&
          donor.availabilityStatus === 'Available' &&
          donor.bloodGroup &&
          donor.bloodGroup.toLowerCase() === bloodRequest.bloodGroup.toLowerCase()
        );
      });

    let donor = matchingDonors[0];
    if (targetDonorId != null) {
      const target = matchingDonors.find((candidate) => candidate.id === targetDonorId);
      if (!target) {
        throw new ForbiddenException(
          'This donor cannot take your request: they must be active, Available, have the same blood group, and not be your own donor',
        );
      }
      donor = target;
    } else if (!donor) {
      throw new ForbiddenException('No available donor matching the blood request');
    }

    let donorOwnerUserId = this.appStorageService.getDonorOwnerUserId(donor);
    donorOwnerUserId = donorOwnerUserId ?? donor.createdByUserId ?? null;
    const requester = bloodRequest.requesterUserId ? this.appStorageService.getUserById(bloodRequest.requesterUserId) : null;

    const updated = this.appStorageService.updateBloodRequest(id, {
      status: 'request_pending',
      requestedToDonorId: donor.id,
      requestedToDonorName: donor.fullName,
      acceptedByDonorId: null,
      acceptedByDonorName: null,
      acceptedAt: null,
    });

    if (!updated) {
      throw new NotFoundException(`Blood request with ID ${id} not found`);
    }

    const windowMs = bloodRequest.urgency === 'urgent' ? 45 * 60_000 : 4 * 60 * 60_000;
    const participation = this.participationLifecycle.createInviteParticipation(
      updated,
      donor.id,
      donorOwnerUserId ?? 0,
      new Date(Date.now() + windowMs),
    );

    if (donorOwnerUserId != null) {
      this.notificationsService.create({
        // Donor owners log in to the app as users.
        recipient: { role: 'user', userId: donorOwnerUserId },
        type: 'system',
        title: 'Incoming blood request',
        message: `A blood request for ${bloodRequest.bloodGroup} is waiting for you.`,
        entityType: 'blood_request',
        entityId: updated.id,
        metadata: {
          bloodRequest: updated,
          donor,
          participationId: participation.id,
          deepLink: `rehma://request/${updated.id}?p=${participation.id}`,
        },
      });
    }

    if (requester) {
      this.notificationsService.create({
        recipient: { role: 'user', userId: requesterUserId },
        type: 'system',
        title: 'Blood request sent',
        message: `Your blood request #${updated.id} has been sent to an available donor.`,
        entityType: 'blood_request',
        entityId: updated.id,
        metadata: { bloodRequest: updated, donor, requester },
      });
    }

    return {
      bloodRequest: {
        id: updated.id,
        bloodGroup: updated.bloodGroup,
        requiredUnits: updated.requiredUnits,
        urgency: updated.urgency,
        status: updated.status,
        latitude: updated.latitude,
        longitude: updated.longitude,
        createdAt: updated.createdAt,
      },
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
      message: 'Blood request sent to an available donor',
    };
  }

  async scheduleBloodRequest(id: number, userId: number, scheduleDate: Date, idempotencyKey?: string) {
    const result = await this.participationLifecycle.scheduleForVolunteerDonor(id, userId, scheduleDate, idempotencyKey);
    const payload = result.body as {
      bloodRequest?: import('../storage/app-storage.service').BloodRequestRecord;
      donor?: { id: number; fullName: string };
    };
    const updated = payload.bloodRequest ?? this.appStorageService.getBloodRequest(id);
    if (!updated) {
      throw new NotFoundException(`Blood request with ID ${id} not found`);
    }

    const donor =
      this.appStorageService.getDonor(updated.acceptedByDonorId!) ??
      (payload.donor ? this.appStorageService.getDonor(payload.donor.id) : undefined);
    const requester = updated.requesterUserId ? this.appStorageService.getUserById(updated.requesterUserId) : null;

    this.notificationsService.notifySuperAdmins({
      type: 'blood_request_matched',
      title: 'Blood donation scheduled',
      message: `Blood request #${updated.id} scheduled for ${scheduleDate.toDateString()} with donor ${updated.acceptedByDonorName}.`,
      entityType: 'blood_request',
      entityId: updated.id,
      metadata: { bloodRequest: updated, donor, requester },
    });

    if (updated.requesterUserId) {
      this.notificationsService.create({
        recipient: { role: 'user', userId: updated.requesterUserId },
        type: 'blood_request_matched',
        title: 'Donation scheduled for your request',
        message: `Your blood request #${updated.id} has been scheduled for ${scheduleDate.toDateString()} with donor ${updated.acceptedByDonorName}.`,
        entityType: 'blood_request',
        entityId: updated.id,
        metadata: { bloodRequest: updated, donor, requester },
      });
    }

    return {
      bloodRequest: updated,
      donor: {
        id: donor?.id,
        fullName: donor?.fullName,
        bloodGroup: donor?.bloodGroup,
        phone: donor?.phone,
        email: donor?.email,
      },
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

  async remove(id: number, userId?: number, userRole?: string) {
    const bloodRequest = await this.findOne(id);
    if (userRole !== 'superadmin' && bloodRequest.requesterUserId !== userId) {
      throw new ForbiddenException('Only the requester or a Super Admin can delete this request');
    }
    this.appStorageService.deleteBloodRequest(id);
    return { message: `Blood request with ID ${id} deleted` };
  }
}
