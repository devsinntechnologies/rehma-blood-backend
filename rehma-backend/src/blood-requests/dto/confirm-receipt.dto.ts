import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class ConfirmReceiptDto {
  @IsBoolean()
  received!: boolean;

  @ApiPropertyOptional({ description: 'Required for multi-unit requests' })
  @IsOptional()
  @IsInt()
  @Min(1)
  unitsReceived?: number;

  @ApiPropertyOptional({ description: 'Participation to confirm (required when requiredUnits > 1)' })
  @IsOptional()
  @IsInt()
  participationId?: number;
}
