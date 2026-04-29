import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBloodRequestDto {
  @ApiProperty({ example: 'Ali Raza', required: false })
  @IsString()
  @IsOptional()
  requesterName?: string;

  @ApiProperty({ example: 'Ali contact', required: false })
  @IsString()
  @IsOptional()
  requesterContact?: string;

  @ApiProperty({ example: 'O+' })
  @IsString()
  bloodGroup!: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  requiredUnits!: number;

  @ApiProperty({ example: 'urgent', enum: ['urgent', 'normal'] })
  @IsIn(['urgent', 'normal'])
  urgency!: 'urgent' | 'normal';

  @ApiProperty({ example: 'Accident patient needs blood quickly', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ example: 31.5204 })
  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @ApiProperty({ example: 74.3587 })
  @Type(() => Number)
  @IsNumber()
  longitude!: number;

}
