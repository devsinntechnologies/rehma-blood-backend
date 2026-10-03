import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';

export class RequestDonorDto {
  @ApiPropertyOptional({ example: 12, description: 'Send the request to this donor instead of the first matching one' })
  @IsOptional()
  @IsInt()
  donorId?: number;
}
