import { Body, Controller, Get, Patch, Post, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { UserAuthService } from './user-auth.service';
import { RegisterUserDto } from './dtos/register-user.dto';
import { LoginUserDto } from './dtos/login-user.dto';
import { UpdateUserProfileDto } from './dtos/update-user-profile.dto';
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
    return this.userAuthService.register(registerUserDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login as user (blood recipient/patient)' })
  @ApiBody({ type: LoginUserDto })
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.userAuthService.login(loginUserDto);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset for a user account' })
  @ApiBody({ type: ForgotPasswordDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.userAuthService.forgotPassword(dto.email);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@Request() req: any) {
    return this.userAuthService.getCurrentUser(req.user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiBody({ type: UpdateUserProfileDto })
  async updateMe(@Request() req: any, @Body() dto: UpdateUserProfileDto) {
    return this.userAuthService.updateCurrentUser(Number(req.user.sub), dto);
  }

  @Get('me/donor-profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Get all donor profiles linked to current user' })
  async getMyDonorProfile(@Request() req: any) {
    return this.userAuthService.getMyDonorProfile(Number(req.user.sub));
  }
}
