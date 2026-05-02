import { Body, Controller, Get, Post, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { UserAuthService } from './user-auth.service';
import { RegisterUserDto } from './dtos/register-user.dto';
import { LoginUserDto } from './dtos/login-user.dto';
import { ForgotPasswordDto } from '../auth/dto/forgot-password.dto';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';

@ApiTags('User Auth')
@Controller('user-auth')
export class UserAuthController {
  constructor(private readonly userAuthService: UserAuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user (blood recipient/patient)' })
  @ApiBody({ type: RegisterUserDto })
  async register(@Body() registerUserDto: RegisterUserDto) {
    try {
      return await this.userAuthService.register(registerUserDto);
    } catch (error) {
      throw new HttpException((error as any).message || 'Registration failed', HttpStatus.BAD_REQUEST);
    }
  }

  @Post('login')
  @ApiOperation({ summary: 'Login as user (blood recipient/patient)' })
  @ApiBody({ type: LoginUserDto })
  async login(@Body() loginUserDto: LoginUserDto) {
    try {
      return await this.userAuthService.login(loginUserDto);
    } catch (error) {
      throw new HttpException((error as any).message || 'Login failed', HttpStatus.UNAUTHORIZED);
    }
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset for a user account' })
  @ApiBody({ type: ForgotPasswordDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    try {
      return await this.userAuthService.forgotPassword(dto.email);
    } catch (error) {
      throw new HttpException((error as any).message || 'Failed to process forgot password request', HttpStatus.BAD_REQUEST);
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@Request() req: any) {
    const user = this.userAuthService.getCurrentUser(req.user.sub);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  @Get('me/donor-profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Get all donor profiles linked to current user' })
  async getMyDonorProfile(@Request() req: any) {
    const donors = this.userAuthService.getMyDonorProfile(Number(req.user.sub));
    if (!donors) {
      throw new HttpException('No donor profiles found for current user', HttpStatus.NOT_FOUND);
    }
    return donors;
  }
}
