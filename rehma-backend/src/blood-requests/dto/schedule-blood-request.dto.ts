import { IsDateString, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScheduleBloodRequestDto {
  @ApiProperty({ example: 12, description: 'Blood request ID to schedule' })
  @IsInt()
  requestId!: number;

  @ApiProperty({ example: '2026-05-10T14:00:00Z', description: 'ISO 8601 date string for scheduled donation' })
  @IsDateString()
  scheduleDate!: string;
}
