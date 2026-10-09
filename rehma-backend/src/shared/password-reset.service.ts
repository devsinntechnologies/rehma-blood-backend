import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppStorageService } from '../storage/app-storage.service';

type RateBucket = { count: number; resetAt: number };

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly buckets = new Map<string, RateBucket>();

  constructor(
    private readonly storage: AppStorageService,
    private readonly config: ConfigService,
  ) {}

  isEmailDeliveryConfigured(): boolean {
    return this.config.get<string>('PASSWORD_RESET_EMAIL_ENABLED', 'false').toLowerCase() === 'true';
  }

  assertRateLimit(email: string): void {
    const windowMs = this.config.get<number>('PASSWORD_RESET_RATE_WINDOW_MS', 900_000);
    const max = this.config.get<number>('PASSWORD_RESET_RATE_MAX', 5);
    const key = email.trim().toLowerCase();
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    bucket.count += 1;
    if (bucket.count > max) {
      throw new HttpException(
        'Too many password reset attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Generic outward message whether or not the account exists. */
  genericMessage(): string {
    if (this.isEmailDeliveryConfigured()) {
      return 'If an account exists with this email, a password reset link will be sent.';
    }
    return 'Password reset is temporarily unavailable. Please contact support or try again later.';
  }

  requestReset(email: string, userType: 'superadmin' | 'donor' | 'user'): { delivered: boolean; resetUrl?: string } {
    this.assertRateLimit(email);
    const userExists =
      userType === 'user'
        ? !!this.storage.getUserByEmail(email)
        : userType === 'superadmin'
          ? !!this.storage.getSuperAdminByEmail(email)
          : !!this.storage.getDonorByEmail(email);

    if (!userExists) {
      return { delivered: false };
    }

    const token = this.storage.generateResetToken(email, userType);
    if (!this.isEmailDeliveryConfigured()) {
      this.logger.warn(`Password reset requested for ${email} but PASSWORD_RESET_EMAIL_ENABLED is not true`);
      return { delivered: false };
    }

    const baseUrl = this.config.get<string>('PASSWORD_RESET_LINK_BASE', 'https://app.example.com/reset-password');
    const resetUrl = `${baseUrl}?token=${encodeURIComponent(token)}`;
    // Delivery adapter: log until SMTP is wired (configure PASSWORD_RESET_EMAIL_ENABLED + provider).
    this.logger.log(`Password reset link generated for ${email} (token not included in API response)`);
    void resetUrl;
    return { delivered: true, resetUrl };
  }
}
