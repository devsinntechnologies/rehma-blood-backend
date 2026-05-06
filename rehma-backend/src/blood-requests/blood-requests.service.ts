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

  findAll() {
    return this.appStorageService.listBloodRequests().sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === 'active' ? -1 : 1;
      }

      if (left.urgency !== right.urgency) {
        return left.urgency === 'urgent' ? -1 : 1;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
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

  async remove(id: number) {
    await this.findOne(id);
    this.appStorageService.deleteBloodRequest(id);
    return { message: `Blood request with ID ${id} deleted` };
  }
}
