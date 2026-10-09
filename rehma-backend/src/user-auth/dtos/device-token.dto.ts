import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RegisterDeviceTokenDto {
  @ApiProperty({ example: 'fcm-device-token-string' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'ios', enum: ['ios', 'android', 'web'] })
  @IsString()
  @IsIn(['ios', 'android', 'web'])
  platform!: string;
}

export class UnregisterDeviceTokenDto {
  @ApiProperty({ example: 'fcm-device-token-string' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
