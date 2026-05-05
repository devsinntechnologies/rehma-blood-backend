import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AppStorageService, UserRecord } from '../storage/app-storage.service';
import { RegisterUserDto } from './dtos/register-user.dto';
import { LoginUserDto } from './dtos/login-user.dto';
import { UpdateUserProfileDto } from './dtos/update-user-profile.dto';

@Injectable()
export class UserAuthService {
  constructor(
    private readonly storageService: AppStorageService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterUserDto): Promise<{ accessToken: string; user: Partial<UserRecord>; donorProfiles: unknown[] }> {
    const existingUserByEmail = this.storageService.getUserByEmail(input.email);
    const existingUserByPhone = this.storageService.getUserByMobileNumber(input.mobileNumber);
    if (existingUserByEmail || existingUserByPhone) {
      throw new ConflictException('User already exists');
    }
    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = this.storageService.registerUser({
      fullName: input.fullName,
      email: input.email,
      mobileNumber: input.mobileNumber,
      dateOfBirth: input.dateOfBirth,
      weight: input.weight,
      bloodGroup: input.bloodGroup,
      passwordHash,
    });

    const donorDetails = {
      fullName: input.fullName,
      email: input.email,
      phone: input.mobileNumber,
      bloodGroup: input.bloodGroup,
      city: input.city ?? null,
      gender: input.gender ?? null,
      dateOfBirth: input.dateOfBirth,
      cnic: input.cnic ?? null,
      profileImage: input.profileImage ?? null,
      lastDonationDate: input.lastDonationDate ?? null,
      medicalNotes: null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      promoCode: input.promoCode ?? null,
    };

    const donorProfiles: unknown[] = [];

    const phoneMatchedDonor = this.storageService.getDonorByPhone(input.mobileNumber);
    if (phoneMatchedDonor?.isVerifiedAccount) {
      throw new ConflictException('Donor with this phone number already exists');
    }

    const primaryDonor = phoneMatchedDonor
      ? this.storageService.transferDonorOwnership(phoneMatchedDonor.id, user.id, donorDetails)
      : this.storageService.createDonorForUser(user.id, donorDetails);

    if (!primaryDonor) {
      throw new BadRequestException('Unable to create donor profile');
    }

    donorProfiles.push(primaryDonor);

    if (input.promoCode) {
      const donor = this.storageService.getDonorByPromoCode(input.promoCode);
      if (!donor) {
        throw new BadRequestException('Invalid promo code');
      }

      // If promo code is on the same donor that was just transferred via phone, skip double-claiming
      if (donor.id !== primaryDonor.id) {
        // Only check claimed status if it's a different donor
        if (donor.isClaimed || donor.isVerifiedAccount) {
          throw new ConflictException('Promo code has already been claimed');
        }

        const claimedDonor = this.storageService.transferDonorOwnership(donor.id, user.id, donorDetails);
        if (!claimedDonor) {
          throw new BadRequestException('Unable to claim promo donor profile');
        }
        donorProfiles.push(claimedDonor);
      }
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: 'user',
    });

    const response: { accessToken: string; user: Partial<UserRecord>; donorProfiles: unknown[] } = {
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
        role: user.role,
      },
      donorProfiles,
    };

    return response;
  }

  async login(input: LoginUserDto): Promise<{ accessToken: string; user: Partial<UserRecord> }> {
    const user = this.storageService.authenticateUser(input.email, input.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
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
        role: user.role,
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

  getCurrentUser(userId: number): Partial<UserRecord> {
    const user = this.storageService.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      dateOfBirth: user.dateOfBirth,
      weight: user.weight,
      bloodGroup: user.bloodGroup,
      lastBloodDonation: user.lastBloodDonation,
      role: user.role,
    };
  }

  getMyDonorProfile(userId: number) {
    const donors = this.storageService.getDonorsByUserId(userId);
    if (donors.length === 0) {
      throw new NotFoundException('No donor profiles found for current user');
    }
    return donors;
  }

  updateCurrentUser(userId: number, input: UpdateUserProfileDto): Partial<UserRecord> {
    const existingUser = this.storageService.getUserById(userId);
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    if (input.email && input.email !== existingUser.email) {
      const userByEmail = this.storageService.getUserByEmail(input.email);
      if (userByEmail && userByEmail.id !== userId) {
        throw new ConflictException('Email is already in use');
      }
    }

    if (input.mobileNumber && input.mobileNumber !== existingUser.mobileNumber) {
      const userByMobile = this.storageService.getUserByMobileNumber(input.mobileNumber);
      if (userByMobile && userByMobile.id !== userId) {
        throw new ConflictException('Mobile number is already in use');
      }
    }

    const user = this.storageService.updateUserProfile(userId, input);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      dateOfBirth: user.dateOfBirth,
      weight: user.weight,
      bloodGroup: user.bloodGroup,
      lastBloodDonation: user.lastBloodDonation,
      role: user.role,
    };
  }
}
