import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AppStorageService } from '../storage/app-storage.service';

@Injectable()
export class SuperAdminAuthService {
  constructor(
    private readonly appStorageService: AppStorageService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const superAdmin = this.appStorageService.getSuperAdminByEmail(email);

    if (!superAdmin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, superAdmin.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: superAdmin.id,
      email: superAdmin.email,
      role: 'superadmin',
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      superAdmin: {
        id: superAdmin.id,
        email: superAdmin.email,
        fullName: superAdmin.fullName,
      },
    };
  }

  async forgotPassword(email: string) {
    // Check if user exists in any role (superadmin, donor, or user)
    const superAdmin = this.appStorageService.getSuperAdminByEmail(email);
    const donor = this.appStorageService.getDonorByEmail(email);
    const user = this.appStorageService.getUserByEmail(email);

    if (!superAdmin && !donor && !user) {
      // For security, always return success message even if user not found
      return { message: 'If an account exists with this email, a password reset link will be sent.' };
    }

    let userType: 'superadmin' | 'donor' | 'user' = 'superadmin';
    if (superAdmin) {
      userType = 'superadmin';
    } else if (donor) {
      userType = 'donor';
    } else if (user) {
      userType = 'user';
    }

    this.appStorageService.generateResetToken(email, userType);
    return {
      message: 'If an account exists with this email, a password reset link will be sent.',
      passwordResetAvailable: false,
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    const result = this.appStorageService.resetPassword(token, newPasswordHash);

    if (!result.success) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    return { message: 'Password reset successfully. You can now login with your new password.' };
  }
}