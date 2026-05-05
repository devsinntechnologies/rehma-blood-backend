import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { DonorsService } from './donors.service';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorDto } from './dto/update-donor.dto';
import { UpdateDonorAvailabilityDto } from './dto/update-donor-availability.dto';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';

@ApiTags('Donors - Admin')
@ApiBearerAuth('jwt')
@Controller('donors')
@UseGuards(JwtAuthGuard)
export class DonorsController {
  constructor(private readonly donorsService: DonorsService) {}

  @Post()
  @ApiOperation({ summary: 'Create or register a donor profile' })
  @ApiBody({ type: CreateDonorDto })
  create(@Request() req: any, @Body() createDonorDto: CreateDonorDto) {
    const userId = req.user?.sub;
    return this.donorsService.create(createDonorDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all donors' })
  findAll() {
    return this.donorsService.findAll();
  }

  @Get('my-created')
  @ApiOperation({ summary: 'List all donors for the authenticated user (created by user + user own donor profile)' })
  getMyCreatedDonors(@Request() req: any) {
    return this.donorsService.getCreatedDonors(Number(req.user.sub));
  }

  @Get(':id/promo')
  @ApiOperation({ summary: 'Get promo code info for a donor' })
  getPromoInfo(@Param('id') id: string) {
    return this.donorsService.getPromoCodeInfo(Number(id));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get donor by ID' })
  findOne(@Param('id') id: string) {
    return this.donorsService.findOne(Number(id));
  }

  @Patch(':id/availability-status')
  @ApiOperation({ summary: 'Update donor availability status (User can update own donor, Superadmin can update any)' })
  @ApiBody({ type: UpdateDonorAvailabilityDto })
  updateAvailabilityStatus(@Param('id') id: string, @Request() req: any, @Body() updateDto: UpdateDonorAvailabilityDto) {
    const userId = req.user?.sub;
    const userRole = req.user?.role;
    return this.donorsService.updateAvailabilityStatus(Number(id), updateDto, userId, userRole);
  }

  @Patch(':id/disable-promo')
  @ApiOperation({ summary: 'Disable promo code for a donor (marks as expired)' })
  disablePromo(@Param('id') id: string) {
    return this.donorsService.disablePromoCode(Number(id));
  }

  @Patch(':id/regenerate-promo')
  @ApiOperation({ summary: 'Regenerate promo code for an unclaimed donor' })
  regeneratePromo(@Param('id') id: string) {
    return this.donorsService.regeneratePromoCode(Number(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update donor profile and availability' })
  @ApiBody({ type: UpdateDonorDto })
  update(@Param('id') id: string, @Request() req: any, @Body() updateDonorDto: UpdateDonorDto) {
    return this.donorsService.update(Number(id), updateDonorDto, Number(req.user?.sub), req.user?.role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete donor' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.donorsService.remove(Number(id), Number(req.user?.sub), req.user?.role);
  }
}
