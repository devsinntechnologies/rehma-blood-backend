import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDonorDto {
  @ApiProperty({ example: 'Ayesha Khan' })
  @IsString()
  fullName!: string;

  @ApiProperty({ example: 'ayesha@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: '+92 300 1234567', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'A+', required: false })
  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @ApiProperty({ example: 31.5204, required: false })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ example: 74.3587, required: false })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  longitude?: number;
}