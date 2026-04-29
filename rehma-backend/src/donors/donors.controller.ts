import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { DonorsService } from './donors.service';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorDto } from './dto/update-donor.dto';
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
  create(@Body() createDonorDto: CreateDonorDto) {
    return this.donorsService.create(createDonorDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all donors' })
  findAll() {
    return this.donorsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get donor by ID' })
  findOne(@Param('id') id: string) {
    return this.donorsService.findOne(Number(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update donor profile and availability' })
  @ApiBody({ type: UpdateDonorDto })
  update(@Param('id') id: string, @Body() updateDonorDto: UpdateDonorDto) {
    return this.donorsService.update(Number(id), updateDonorDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete donor' })
  remove(@Param('id') id: string) {
    return this.donorsService.remove(Number(id));
  }
}
