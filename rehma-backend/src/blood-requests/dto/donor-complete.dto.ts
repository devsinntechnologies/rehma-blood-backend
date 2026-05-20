import { IsOptional, IsNumber } from 'class-validator';

export class DonorCompleteDto {
  @IsOptional()
  @IsNumber()
  donorId?: number; // optional, can be derived from JWT
}
