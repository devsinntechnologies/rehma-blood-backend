import { Injectable } from '@nestjs/common';
import { AppStorageService, DonorRecord } from '../storage/app-storage.service';
import { NearbyDonorsQueryDto } from './dto/nearby-donors-query.dto';

@Injectable()
export class MapService {
  constructor(private readonly appStorageService: AppStorageService) {}

  getNearbyDonors(query: NearbyDonorsQueryDto) {
    const donors = this.findNearbyDonors(query);

    return {
      currentLocation: {
        latitude: query.latitude,
        longitude: query.longitude,
      },
      donors,
    };
  }

  getActiveRequests() {
    const requests = this.appStorageService.listActiveBloodRequests();
    return {
      requests: requests.map((request) => ({
        id: request.id,
        bloodGroup: request.bloodGroup,
        urgency: request.urgency,
        requiredUnits: request.requiredUnits,
        latitude: request.latitude,
        longitude: request.longitude,
        status: request.status,
        notes: request.notes,
      })),
    };
  }

  getOverview(query: NearbyDonorsQueryDto) {
    return {
      currentLocation: {
        latitude: query.latitude,
        longitude: query.longitude,
      },
      donors: this.findNearbyDonors(query),
      requests: this.appStorageService
        .getActiveRequestsForBloodGroup(query.bloodGroup)
        .map((request) => ({
          id: request.id,
          bloodGroup: request.bloodGroup,
          urgency: request.urgency,
          requiredUnits: request.requiredUnits,
          latitude: request.latitude,
          longitude: request.longitude,
          status: request.status,
          notes: request.notes,
        })),
    };
  }

  private findNearbyDonors(query: NearbyDonorsQueryDto) {
    const donors = this.appStorageService.getRelevantDonors(query.bloodGroup);
    return donors
      .map((donor) => ({
        ...donor,
        distanceKm: this.distanceKm(query.latitude, query.longitude, donor.latitude, donor.longitude),
      }))
      .filter((donor) => donor.distanceKm <= (query.radiusKm ?? 25))
      .sort((left, right) => left.distanceKm - right.distanceKm);
  }

  private distanceKm(
    latitudeA: number,
    longitudeA: number,
    latitudeB?: number | null,
    longitudeB?: number | null,
  ): number {
    if (latitudeB === undefined || longitudeB === undefined || latitudeB === null || longitudeB === null) {
      return Number.POSITIVE_INFINITY;
    }

    const earthRadiusKm = 6371;
    const deltaLatitude = this.toRadians(latitudeB - latitudeA);
    const deltaLongitude = this.toRadians(longitudeB - longitudeA);
    const a =
      Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
      Math.cos(this.toRadians(latitudeA)) *
        Math.cos(this.toRadians(latitudeB)) *
        Math.sin(deltaLongitude / 2) *
        Math.sin(deltaLongitude / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((earthRadiusKm * c).toFixed(2));
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }
}