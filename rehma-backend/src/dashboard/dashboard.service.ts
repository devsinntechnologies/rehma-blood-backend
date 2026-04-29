import { Injectable } from '@nestjs/common';
import { AppStorageService } from '../storage/app-storage.service';

@Injectable()
export class DashboardService {
  constructor(private readonly appStorageService: AppStorageService) {}

  async getStats() {
    const activeRequests = this.appStorageService.listActiveBloodRequests();
    const urgentRequests = this.appStorageService.listUrgentBloodRequests();

    return {
      ...this.appStorageService.stats(),
      activeRequests: activeRequests.length,
      urgentRequests: urgentRequests.length,
      availableDonors: this.appStorageService.getRelevantDonors().length,
    };
  }
}