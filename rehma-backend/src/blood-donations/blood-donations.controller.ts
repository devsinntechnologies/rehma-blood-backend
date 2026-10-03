import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Request } from '@nestjs/common';
import { BloodDonationsService } from './blood-donations.service';
import { CreateBloodDonationDto } from './dto/create-blood-donation.dto';
import { UpdateBloodDonationDto } from './dto/update-blood-donation.dto';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { SuperAdminRoleGuard } from '../shared/guards/superadmin-role.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';

@ApiTags('Blood Donations')
@ApiBearerAuth('jwt')
@Controller('blood-donations')
@UseGuards(JwtAuthGuard)
export class BloodDonationsController {
  constructor(private readonly bloodDonationsService: BloodDonationsService) {}

  @Post()
  @UseGuards(SuperAdminRoleGuard)
  @ApiOperation({ summary: 'Create a blood donation record' })
  @ApiBody({ type: CreateBloodDonationDto })
  create(@Body() createBloodDonationDto: CreateBloodDonationDto) {
    return this.bloodDonationsService.create(createBloodDonationDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all blood donations (authorized user donations or all if superadmin)' })
  findAll(@Request() req: any) {
    const userId = req.user?.sub;
    const userRole = req.user?.role;
    return this.bloodDonationsService.findAll(userId ? Number(userId) : undefined, userRole);
  }

  @Get(':id')
  @UseGuards(SuperAdminRoleGuard)
  @ApiOperation({ summary: 'Get blood donation by ID' })
  findOne(@Param('id') id: string) {
    return this.bloodDonationsService.findOne(Number(id));
  }

  @Patch(':id')
  @UseGuards(SuperAdminRoleGuard)
  @ApiOperation({ summary: 'Update blood donation record' })
  @ApiBody({ type: UpdateBloodDonationDto })
  update(@Param('id') id: string, @Body() updateBloodDonationDto: UpdateBloodDonationDto) {
    return this.bloodDonationsService.update(Number(id), updateBloodDonationDto);
  }

  @Delete(':id')
  @UseGuards(SuperAdminRoleGuard)
  @ApiOperation({ summary: 'Delete blood donation record' })
  remove(@Param('id') id: string) {
    return this.bloodDonationsService.remove(Number(id));
  }
}
