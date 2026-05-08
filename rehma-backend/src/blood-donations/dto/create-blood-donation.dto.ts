import { IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBloodDonationDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  donorId!: number;

  @ApiProperty({ example: 'Ayesha Khan' })
  @IsString()
  donorName!: string;

  @ApiProperty({ example: 'O+' })
  @IsString()
  bloodGroup!: string;
}
