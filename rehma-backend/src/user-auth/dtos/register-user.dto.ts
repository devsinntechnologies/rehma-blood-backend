import { IsDateString, IsEmail, IsNotEmpty, IsNumber, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RegisterUserDto {
  @ApiProperty({ example: 'Muhammad Ali' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'ali@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '+923001234567' })
  @IsString()
  @IsNotEmpty()
  mobileNumber!: string;

  @ApiProperty({ example: '1995-08-15' })
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty({ example: 72 })
  @Type(() => Number)
  @IsNumber()
  weight!: number;

  @ApiProperty({ example: 'A+' })
  @IsString()
  @IsNotEmpty()
  bloodGroup!: string;

  @ApiProperty({ example: '2025-01-10' })
  @IsDateString()
  lastBloodDonation!: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ example: 'RB-82JKL', description: 'Optional promo/referral code from an inviter' })
  @IsOptional()
  @IsString()
  promoCode?: string;
}
