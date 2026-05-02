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

    // Create the user
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

    let claimedDonor: any = undefined;

    // If a promo code supplied, claim the invited donor
    if (input.promoCode) {
      const donor = this.storageService.getDonorByPromoCode(input.promoCode);
      if (!donor) {
        throw new Error('Invalid promo code');
      }
      if (donor.isClaimed) {
        throw new Error('Promo code has already been claimed');
      }

      // Link donor to user
      claimedDonor = this.storageService.markDonorClaimed(donor.id, user.id, user.id);
    }

    // Automatically create a donor record for the newly registered user
    const userDonor = this.storageService.createDonorFromUser(user.id, user);

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: 'user',
    });

    const response: { accessToken: string; user: Partial<UserRecord>; donors?: any[] } = {
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

    // Return both claimed donor and user's own donor record
    const donors = [];
    if (claimedDonor) {
      donors.push(claimedDonor);
    }
    if (userDonor) {
      donors.push(userDonor);
    }
    if (donors.length > 0) {
      response.donors = donors;
    }

    return response;
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

  async forgotPassword(email: string): Promise<{ message: string; resetToken?: string }> {
    const user = this.storageService.getUserByEmail(email);

    if (!user) {
      return { message: 'If an account exists with this email, a password reset link will be sent.' };
    }

    const resetToken = this.storageService.generateResetToken(email, 'user');

    return {
      message: 'Password reset token generated. Use this token to reset your password.',
      resetToken,
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

  getMyDonorProfile(userId: number) {
    // Get all donors linked to this user (both claimed and created)
    const donors = this.storageService.getAllDonorsByLinkedUserId(userId);
    return donors.length > 0 ? donors : null;
  }
}
