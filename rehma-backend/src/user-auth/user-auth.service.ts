import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AppStorageService, UserRecord } from '../storage/app-storage.service';
import { RegisterUserDto } from './dtos/register-user.dto';
import { LoginUserDto } from './dtos/login-user.dto';

@Injectable()
export class UserAuthService {
  constructor(
    private readonly storageService: AppStorageService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterUserDto): Promise<{ accessToken: string; user: Partial<UserRecord> }> {
    const existingUser = this.storageService.getUserByEmail(input.email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = this.storageService.registerUser({
      fullName: input.fullName,
      email: input.email,
      mobileNumber: input.mobileNumber,
      dateOfBirth: input.dateOfBirth,
      weight: input.weight,
      bloodGroup: input.bloodGroup,
      lastBloodDonation: input.lastBloodDonation,
      passwordHash,
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: 'user',
    });

    return {
      accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        mobileNumber: user.mobileNumber,
        dateOfBirth: user.dateOfBirth,
        weight: user.weight,
        bloodGroup: user.bloodGroup,
        lastBloodDonation: user.lastBloodDonation,
      },
    };
  }

  async login(input: LoginUserDto): Promise<{ accessToken: string; user: Partial<UserRecord> }> {
    const user = this.storageService.authenticateUser(input.email, input.password);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: 'user',
    });

    return {
      accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        mobileNumber: user.mobileNumber,
        dateOfBirth: user.dateOfBirth,
        weight: user.weight,
        bloodGroup: user.bloodGroup,
        lastBloodDonation: user.lastBloodDonation,
      },
    };
  }

  getCurrentUser(userId: number): Partial<UserRecord> | null {
    const user = this.storageService.getUserById(userId);
    if (!user) return null;
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      dateOfBirth: user.dateOfBirth,
      weight: user.weight,
      bloodGroup: user.bloodGroup,
      lastBloodDonation: user.lastBloodDonation,
    };
  }
}
