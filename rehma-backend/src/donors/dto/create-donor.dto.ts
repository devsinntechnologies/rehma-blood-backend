import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateDonorDto {
  @ApiPropertyOptional({ example: 'Ayesha Khan' })
  @IsString()
  fullName!: string;

  @ApiPropertyOptional({ example: 'ayesha@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+92 300 1234567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'A+' })
  @IsString()
  @IsOptional()
  bloodGroup?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @ApiPropertyOptional({ example: 31.5204 })
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 74.3587 })
  @IsOptional()
  longitude?: number;
}
