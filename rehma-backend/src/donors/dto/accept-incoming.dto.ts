import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class AcceptIncomingDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  unitsCommitted?: number;
}
