import { IsBoolean, IsOptional } from 'class-validator';

export class ConfirmReceiptDto {
  @IsBoolean()
  received!: boolean;
}
