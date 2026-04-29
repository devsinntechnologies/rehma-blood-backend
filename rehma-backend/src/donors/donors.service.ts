import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorDto } from './dto/update-donor.dto';
import { AppStorageService } from '../storage/app-storage.service';

@Injectable()
export class DonorsService {
  constructor(private readonly appStorageService: AppStorageService) {}

  create(createDonorDto: CreateDonorDto) {
    return this.appStorageService.addDonor(createDonorDto);
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
}
