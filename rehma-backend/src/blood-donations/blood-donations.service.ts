import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBloodDonationDto } from './dto/create-blood-donation.dto';
import { UpdateBloodDonationDto } from './dto/update-blood-donation.dto';
import { AppStorageService } from '../storage/app-storage.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BloodDonationsService {
  constructor(
    private readonly appStorageService: AppStorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  create(createBloodDonationDto: CreateBloodDonationDto) {
    const bloodDonation = this.appStorageService.addBloodDonation(createBloodDonationDto);

    this.notificationsService.notifySuperAdmins({
      type: 'blood_donation_created',
      title: 'Blood donation recorded',
      message: `Donation by ${bloodDonation.donorName} for ${bloodDonation.bloodGroup} was recorded.`,
      entityType: 'blood_donation',
      entityId: bloodDonation.id,
      metadata: { bloodDonation },
    });

    return bloodDonation;
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

    this.notificationsService.notifySuperAdmins({
      type: 'blood_donation_updated',
      title: 'Blood donation updated',
      message: `Donation #${bloodDonation.id} was updated.`,
      entityType: 'blood_donation',
      entityId: bloodDonation.id,
      metadata: { bloodDonation },
    });

    return bloodDonation;
  }

  async remove(id: number) {
    await this.findOne(id);
    this.appStorageService.deleteBloodDonation(id);
    return { message: `Blood donation with ID ${id} deleted` };
  }
}
