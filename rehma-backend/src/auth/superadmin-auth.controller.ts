import { Body, Controller, Post, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { SuperAdminAuthService } from './superadmin-auth.service';
import { LoginSuperAdminDto } from './dto/login-superadmin.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Auth')
@Controller('auth')
export class SuperAdminAuthController {
  constructor(private readonly authService: SuperAdminAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login as superadmin' })
  @ApiBody({ type: LoginSuperAdminDto })
  login(@Body() dto: LoginSuperAdminDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset (works for superadmin, donor, and user accounts)' })
  @ApiBody({ type: ForgotPasswordDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    try {
      return await this.authService.forgotPassword(dto.email);
    } catch (error) {
      throw new HttpException((error as any).message || 'Failed to process forgot password request', HttpStatus.BAD_REQUEST);
    }
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using reset token' })
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    try {
      return await this.authService.resetPassword(dto.token, dto.newPassword);
    } catch (error) {
      throw new HttpException((error as any).message || 'Password reset failed', HttpStatus.BAD_REQUEST);
    }
  }
}