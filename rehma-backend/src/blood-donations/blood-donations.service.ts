import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBloodDonationDto } from './dto/create-blood-donation.dto';
import { UpdateBloodDonationDto } from './dto/update-blood-donation.dto';
import { AppStorageService } from '../storage/app-storage.service';

@Injectable()
export class BloodDonationsService {
  constructor(private readonly appStorageService: AppStorageService) {}

  create(createBloodDonationDto: CreateBloodDonationDto) {
    return this.appStorageService.addBloodDonation(createBloodDonationDto);
  }

  findAll() {
    return this.appStorageService.listBloodDonations();
  }

  async findOne(id: number) {
    const bloodDonation = this.appStorageService.getBloodDonation(id);
    if (!bloodDonation) {
      throw new NotFoundException(`Blood donation with ID ${id} not found`);
    }
    return bloodDonation;
  }

  async update(id: number, updateBloodDonationDto: UpdateBloodDonationDto) {
    await this.findOne(id);
    const bloodDonation = this.appStorageService.updateBloodDonation(id, updateBloodDonationDto);
    if (!bloodDonation) {
      throw new NotFoundException(`Blood donation with ID ${id} not found`);
    }
    return bloodDonation;
  }

  async remove(id: number) {
    await this.findOne(id);
    this.appStorageService.deleteBloodDonation(id);
    return { message: `Blood donation with ID ${id} deleted` };
  }
}
