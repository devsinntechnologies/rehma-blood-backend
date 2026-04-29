import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BloodDonationsService } from './blood-donations.service';
import { CreateBloodDonationDto } from './dto/create-blood-donation.dto';
import { UpdateBloodDonationDto } from './dto/update-blood-donation.dto';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';

@ApiTags('Blood Donations')
@ApiBearerAuth('jwt')
@Controller('blood-donations')
@UseGuards(JwtAuthGuard)
export class BloodDonationsController {
  constructor(private readonly bloodDonationsService: BloodDonationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a blood donation record' })
  @ApiBody({ type: CreateBloodDonationDto })
  create(@Body() createBloodDonationDto: CreateBloodDonationDto) {
    return this.bloodDonationsService.create(createBloodDonationDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all blood donations' })
  findAll() {
    return this.bloodDonationsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get blood donation by ID' })
  findOne(@Param('id') id: string) {
    return this.bloodDonationsService.findOne(Number(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update blood donation record' })
  @ApiBody({ type: UpdateBloodDonationDto })
  update(@Param('id') id: string, @Body() updateBloodDonationDto: UpdateBloodDonationDto) {
    return this.bloodDonationsService.update(Number(id), updateBloodDonationDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete blood donation record' })
  remove(@Param('id') id: string) {
    return this.bloodDonationsService.remove(Number(id));
  }
}
