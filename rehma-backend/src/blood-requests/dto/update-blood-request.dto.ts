import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateBloodRequestDto {
  @ApiPropertyOptional({ example: 'Ali Raza' })
  @IsString()
  @IsOptional()
  requesterName?: string;

  @ApiPropertyOptional({ example: 'O+' })
  @IsString()
  @IsOptional()
  bloodGroup?: string;

  @ApiPropertyOptional({ example: 2 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  requiredUnits?: number;

  @ApiPropertyOptional({ example: 'urgent', enum: ['urgent', 'normal'] })
  @IsIn(['urgent', 'normal'])
  @IsOptional()
  urgency?: 'urgent' | 'normal';

  @ApiPropertyOptional({ example: 'Accident patient needs blood quickly' })
  @IsString()
  @IsOptional()
  status?: 'active' | 'completed';

  @ApiPropertyOptional({ example: 31.5204 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 74.3587 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ example: 'Updated note' })
  @IsString()
  @IsOptional()
  notes?: string;
}
