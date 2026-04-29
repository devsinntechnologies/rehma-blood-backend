import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { BloodRequestsService } from './blood-requests.service';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { CompleteBloodRequestDto } from './dto/complete-blood-request.dto';
import { UpdateBloodRequestDto } from './dto/update-blood-request.dto';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';

@ApiTags('Blood Requests')
@ApiBearerAuth('jwt')
@Controller('blood-requests')
@UseGuards(JwtAuthGuard)
export class BloodRequestsController {
  constructor(private readonly bloodRequestsService: BloodRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a blood request' })
  @ApiBody({ type: CreateBloodRequestDto })
  create(@Body() createBloodRequestDto: CreateBloodRequestDto) {
    return this.bloodRequestsService.create(createBloodRequestDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all requests, urgent first' })
  findAll() {
    return this.bloodRequestsService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'List active requests' })
  findActive() {
    return this.bloodRequestsService.findActive();
  }

  @Get('urgent')
  @ApiOperation({ summary: 'List urgent active requests' })
  findUrgent() {
    return this.bloodRequestsService.findUrgent();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get blood request by ID' })
  findOne(@Param('id') id: string) {
    return this.bloodRequestsService.findOne(Number(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update blood request' })
  @ApiBody({ type: UpdateBloodRequestDto })
  update(@Param('id') id: string, @Body() updateBloodRequestDto: UpdateBloodRequestDto) {
    return this.bloodRequestsService.update(Number(id), updateBloodRequestDto);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark request as completed and attach donor' })
  @ApiBody({ type: CompleteBloodRequestDto })
  complete(@Param('id') id: string, @Body() body: CompleteBloodRequestDto) {
    return this.bloodRequestsService.complete(Number(id), Number(body.donorId));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete blood request' })
  remove(@Param('id') id: string) {
    return this.bloodRequestsService.remove(Number(id));
  }
}
