import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional } from 'class-validator';

export class UpdateBloodRequestStatusDto {
  @ApiProperty({
    example: 'accepted',
    enum: ['accepted', 'on_the_way', 'arrived_at_hospital', 'donation_completed'],
  })
  @IsIn(['accepted', 'on_the_way', 'arrived_at_hospital', 'donation_completed'])
  status!: 'accepted' | 'on_the_way' | 'arrived_at_hospital' | 'donation_completed';

  @ApiPropertyOptional({ example: 12, description: 'Optional donor ID; defaults to the authenticated donor when available.' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  donorId?: number;
}