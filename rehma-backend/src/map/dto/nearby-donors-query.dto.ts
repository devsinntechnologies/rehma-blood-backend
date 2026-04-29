import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class NearbyDonorsQueryDto {
  @ApiProperty({ example: 31.5204 })
  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @ApiProperty({ example: 74.3587 })
  @Type(() => Number)
  @IsNumber()
  longitude!: number;

  @ApiProperty({ example: 'A+', required: false })
  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @ApiProperty({ example: 25, required: false })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  radiusKm?: number = 25;
}