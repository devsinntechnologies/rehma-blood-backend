import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDonorAvailabilityDto {
  @ApiProperty({
    example: 'Available',
    enum: ['Available', 'Not Available', 'Emergency Only', 'Recently Donated'],
    description: 'Donor availability status',
  })
  @IsEnum(['Available', 'Not Available', 'Emergency Only', 'Recently Donated'])
  @IsNotEmpty()
  availabilityStatus!: 'Available' | 'Not Available' | 'Emergency Only' | 'Recently Donated';
}
