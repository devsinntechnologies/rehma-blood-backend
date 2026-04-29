import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AppStorageService } from '../storage/app-storage.service';
import { RegisterDonorDto } from './dto/register-donor.dto';

@Injectable()
export class DonorAuthService {
  private readonly jwtService = new JwtService({
    secret: process.env.JWT_SECRET ?? 'change-me',
    signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '1d' },
  });

  constructor(private readonly appStorageService: AppStorageService) {}

  async register(dto: RegisterDonorDto) {
    const existingDonor = this.appStorageService.getDonorByEmail(dto.email);
    if (existingDonor?.passwordHash) {
      throw new BadRequestException('Donor already registered with this email');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const donor = this.appStorageService.registerDonor({
      fullName: dto.fullName,
      email: dto.email,
      passwordHash,
      phone: dto.phone,
      bloodGroup: dto.bloodGroup,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });

    return this.buildAuthResponse(donor.id, donor.email ?? dto.email, donor.fullName);
  }

  async login(email: string, password: string) {
    const donor = this.appStorageService.authenticateDonor(email, password);
    if (!donor) {
      throw new UnauthorizedException('Invalid donor credentials');
    }

    return this.buildAuthResponse(donor.id, donor.email ?? email, donor.fullName);
  }

  me(donorId: number) {
    const donor = this.appStorageService.getDonor(donorId);
    if (!donor) {
      throw new NotFoundException('Donor not found');
    }
    return donor;
  }

  updateAvailability(donorId: number, isAvailable: boolean) {
    const donor = this.appStorageService.updateDonorAvailability(donorId, isAvailable);
    if (!donor) {
      throw new NotFoundException('Donor not found');
    }
    return donor;
  }

  updateLocation(donorId: number, latitude: number, longitude: number) {
    const donor = this.appStorageService.updateDonorLocation(donorId, latitude, longitude);
    if (!donor) {
      throw new NotFoundException('Donor not found');
    }
    return donor;
  }

  private buildAuthResponse(id: number, email: string, fullName: string) {
    return {
      accessToken: this.jwtService.sign({ sub: id, email, role: 'donor' }),
      donor: { id, email, fullName },
    };
  }
}