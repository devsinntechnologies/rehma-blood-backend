import { Body, Controller, Get, Patch, Post, Request, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { DonorAuthService } from './donor-auth.service';
import { LoginDonorDto } from './dto/login-donor.dto';
import { RegisterDonorDto } from './dto/register-donor.dto';
import { UpdateDonorAvailabilityDto } from './dto/update-donor-availability.dto';
import { UpdateDonorLocationDto } from './dto/update-donor-location.dto';

@ApiTags('Donor Auth')
@Controller('donor-auth')
export class DonorAuthController {
  constructor(private readonly donorAuthService: DonorAuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a donor account' })
  @ApiBody({ type: RegisterDonorDto })
  register(@Body() dto: RegisterDonorDto) {
    throw new HttpException('Donor registration endpoint is deprecated. Use POST /user-auth/register with `promoCode` instead.', HttpStatus.GONE);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login as a donor' })
  @ApiBody({ type: LoginDonorDto })
  login(@Body() dto: LoginDonorDto) {
    return this.donorAuthService.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Get donor profile' })
  me(@Request() request: any) {
    return this.donorAuthService.me(Number(request.user.sub));
  }

  @Patch('availability')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Update donor availability' })
  @ApiBody({ type: UpdateDonorAvailabilityDto })
  updateAvailability(@Request() request: any, @Body() dto: UpdateDonorAvailabilityDto) {
    return this.donorAuthService.updateAvailability(Number(request.user.sub), dto.isAvailable);
  }

  @Patch('location')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Update donor location' })
  @ApiBody({ type: UpdateDonorLocationDto })
  updateLocation(@Request() request: any, @Body() dto: UpdateDonorLocationDto) {
    return this.donorAuthService.updateLocation(Number(request.user.sub), dto.latitude, dto.longitude);
  }
}