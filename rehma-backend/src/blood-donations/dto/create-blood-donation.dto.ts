import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBloodDonationDto {
  @ApiProperty({ example: 'Ayesha Khan' })
  @IsString()
  donorName!: string;

  @ApiProperty({ example: 'O+' })
  @IsString()
  bloodGroup!: string;
}
