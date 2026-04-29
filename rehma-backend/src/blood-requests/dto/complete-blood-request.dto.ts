import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class CompleteBloodRequestDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  donorId!: number;
}