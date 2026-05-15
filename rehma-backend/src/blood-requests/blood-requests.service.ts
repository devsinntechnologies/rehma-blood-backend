import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { UpdateBloodRequestDto } from './dto/update-blood-request.dto';
import { AppStorageService } from '../storage/app-storage.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BloodRequestsService {
  constructor(
    private readonly appStorageService: AppStorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  create(createBloodRequestDto: CreateBloodRequestDto, userId?: number) {
    // Check if user has at least one available donor to create a blood request
    if (userId) {
      if (this.appStorageService.hasOpenBloodRequestForUser(userId)) {
        throw new ForbiddenException('You already have an open blood request. Complete it before creating a new one');
      }

      const hasAvailable = this.appStorageService.hasAvailableDonor(userId);
      if (!hasAvailable) {
        throw new ForbiddenException('You must have at least one donor with Available status to create a blood request');
      }
    }

    const bloodRequest = this.appStorageService.addBloodRequest({
      ...createBloodRequestDto,
      requesterUserId: userId ?? null,
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

  async update(id: number, updateBloodRequestDto: UpdateBloodRequestDto) {
    await this.findOne(id);
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

  complete(id: number, donorId: number) {
    const bloodRequest = this.appStorageService.completeBloodRequest(id, donorId);
    if (!bloodRequest) {
      throw new NotFoundException(`Blood request or donor not found`);
    }

    this.notificationsService.notifySuperAdmins({
      type: 'blood_request_completed',
      title: 'Blood request completed',
      message: `Blood request #${bloodRequest.id} was completed by donor #${donorId}.`,
      entityType: 'blood_request',
      entityId: bloodRequest.id,
      metadata: { bloodRequest, donorId },
    });

    if (bloodRequest.requesterUserId) {
      this.notificationsService.create({
        recipient: { role: 'user', userId: bloodRequest.requesterUserId },
        type: 'blood_request_completed',
        title: 'Blood request completed',
        message: `Your blood request #${bloodRequest.id} has been completed.`,
        entityType: 'blood_request',
        entityId: bloodRequest.id,
        metadata: { bloodRequest, donorId },
      });
    }

    return bloodRequest;
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

  requestAnyAvailableDonor(id: number, requesterUserId: number) {
    const bloodRequest = this.appStorageService.getBloodRequest(id);
    if (!bloodRequest) {
      throw new NotFoundException(`Blood request with ID ${id} not found`);
    }

    if (bloodRequest.requesterUserId != null && bloodRequest.requesterUserId !== requesterUserId) {
      throw new ForbiddenException('You can only request donors for your own blood request');
    }

    if (bloodRequest.status !== 'active') {
      throw new ForbiddenException('Only active blood requests can be requested');
    }

    const matchingDonors = this.appStorageService
      .listDonors()
      .filter((donor) => {
        const donorOwnerUserId = this.appStorageService.getDonorOwnerUserId(donor);
        const ownerUserId = donorOwnerUserId ?? donor.createdByUserId ?? null;
        return (
          ownerUserId != null &&
          ownerUserId !== requesterUserId &&
          donor.isAvailable &&
          donor.availabilityStatus === 'Available' &&
          donor.bloodGroup &&
          donor.bloodGroup.toLowerCase() === bloodRequest.bloodGroup.toLowerCase()
        );
      });

    if (!matchingDonors.length) {
      throw new ForbiddenException('No available donor matching the blood request');
    }

    const donor = matchingDonors[0];
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

    if (donorOwnerUserId != null) {
      this.notificationsService.create({
        recipient: { role: 'donor', userId: donorOwnerUserId },
        type: 'system',
        title: 'Incoming blood request',
        message: `A blood request for ${bloodRequest.bloodGroup} is waiting for you.`,
        entityType: 'blood_request',
        entityId: updated.id,
        metadata: { bloodRequest: updated, donor },
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

  scheduleBloodRequest(id: number, userId: number, scheduleDate: Date) {
    const bloodRequest = this.appStorageService.getBloodRequest(id);
    if (!bloodRequest) {
      throw new NotFoundException(`Blood request with ID ${id} not found`);
    }

    if (bloodRequest.status !== 'active') {
      throw new ForbiddenException('Only active blood requests can be scheduled');
    }

    const updated = this.appStorageService.scheduleBloodRequest(id, userId, scheduleDate);
    if (!updated) {
      throw new ForbiddenException('No available donor matching the blood request');
    }

    // Fetch donor and requester details for response
    const donor = this.appStorageService.getDonor(updated.acceptedByDonorId!);
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

  async remove(id: number) {
    await this.findOne(id);
    this.appStorageService.deleteBloodRequest(id);
    return { message: `Blood request with ID ${id} deleted` };
  }
}
