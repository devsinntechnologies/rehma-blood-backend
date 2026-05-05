import { ConflictException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorDto } from './dto/update-donor.dto';
import { UpdateDonorAvailabilityDto } from './dto/update-donor-availability.dto';
import { AppStorageService } from '../storage/app-storage.service';

@Injectable()
export class DonorsService {
  constructor(private readonly appStorageService: AppStorageService) {}

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

    return { donor, promoCode: promo, message: 'Donor profile created successfully' };
  }

  findAll() {
    return this.appStorageService.listDonors();
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
    return { donor: updated, message: `Donor availability status updated to ${updateDto.availabilityStatus}` };
  }

  async remove(id: number, userId?: number, userRole?: string) {
    await this.findOne(id);
    if (!this.canManageDonor(id, userId, userRole)) {
      throw new ForbiddenException('Only the donor owner or superadmin can delete this donor');
    }

    this.appStorageService.deleteDonor(id);
    return { message: `Donor with ID ${id} deleted` };
  }

  getCreatedDonors(userId: number) {
    const allDonors = this.appStorageService.getAllMyDonors(userId);
    // Return only one donor per phone number (merge duplicate donors with same phone)
    const donorsByPhone = new Map();
    for (const donor of allDonors) {
      if (!donorsByPhone.has(donor.phone)) {
        donorsByPhone.set(donor.phone, donor);
      }
    }
    return Array.from(donorsByPhone.values());
  }

  disablePromoCode(id: number) {
    const donor = this.appStorageService.disablePromoCode(id);
    if (!donor) {
      throw new NotFoundException(`Donor with ID ${id} not found`);
    }
    return { donor, message: 'Promo code disabled' };
  }

  regeneratePromoCode(id: number) {
    const result = this.appStorageService.regeneratePromoCode(id);
    if (!result) {
      throw new NotFoundException(`Donor with ID ${id} not found`);
    }
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
