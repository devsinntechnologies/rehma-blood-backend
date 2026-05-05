import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { UpdateBloodRequestDto } from './dto/update-blood-request.dto';
import { AppStorageService } from '../storage/app-storage.service';

@Injectable()
export class BloodRequestsService {
  constructor(private readonly appStorageService: AppStorageService) {}

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

    return this.appStorageService.addBloodRequest({
      ...createBloodRequestDto,
      requesterUserId: userId ?? null,
    });
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
    return bloodRequest;
  }

  complete(id: number, donorId: number) {
    const bloodRequest = this.appStorageService.completeBloodRequest(id, donorId);
    if (!bloodRequest) {
      throw new NotFoundException(`Blood request or donor not found`);
    }
    return bloodRequest;
  }

  async remove(id: number) {
    await this.findOne(id);
    this.appStorageService.deleteBloodRequest(id);
    return { message: `Blood request with ID ${id} deleted` };
  }
}
