import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BloodDonationRecord } from '../../storage/app-storage.service';

export class UpdateBloodDonationDto {
  @ApiPropertyOptional({ example: 'Ayesha Khan' })
  @IsString()
  @IsOptional()
  donorName?: string;

  @ApiPropertyOptional({ example: 'O+' })
  @IsString()
  @IsOptional()
  bloodGroup?: string;

  @ApiPropertyOptional({ example: 'completed' })
  @IsIn(['request_pending', 'request_accepted', 'donation_pending', 'completed'])
  @IsOptional()
  status?: BloodDonationRecord['status'];
}
