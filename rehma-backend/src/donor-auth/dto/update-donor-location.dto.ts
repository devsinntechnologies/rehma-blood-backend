import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class UpdateDonorLocationDto {
  @ApiProperty({ example: 31.5204 })
  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @ApiProperty({ example: 74.3587 })
  @Type(() => Number)
  @IsNumber()
  longitude!: number;
}