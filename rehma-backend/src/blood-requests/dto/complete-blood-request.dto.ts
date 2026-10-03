import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';

export class CompleteBloodRequestDto {
  /** Ignored: the donation is credited to the donor who accepted the request. Kept for older app versions. */
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  donorId?: number;
}
