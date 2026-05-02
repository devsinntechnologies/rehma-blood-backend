import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorDto } from './dto/update-donor.dto';
import { AppStorageService } from '../storage/app-storage.service';

@Injectable()
export class DonorsService {
  constructor(private readonly appStorageService: AppStorageService) {}
  create(createDonorDto: CreateDonorDto, createdByUserId?: number) {
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
    });

    return { donor, promoCode: promo };
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

  async update(id: number, updateDonorDto: UpdateDonorDto) {
    await this.findOne(id);
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

  async remove(id: number) {
    await this.findOne(id);
    this.appStorageService.deleteDonor(id);
    return { message: `Donor with ID ${id} deleted` };
  }

  getCreatedDonors(userId: number) {
    return this.appStorageService.getAllMyDonors(userId);
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
