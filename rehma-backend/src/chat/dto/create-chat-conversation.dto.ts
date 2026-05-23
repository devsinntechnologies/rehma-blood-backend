import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ChatParticipantInputDto {
  @ApiProperty({ enum: ['superadmin', 'donor', 'user'] })
  @IsIn(['superadmin', 'donor', 'user'])
  role!: 'superadmin' | 'donor' | 'user';

  @ApiProperty({ example: 7 })
  @Type(() => Number)
  @IsInt()
  userId!: number;
}

export class CreateChatConversationDto {
  @ApiPropertyOptional({ enum: ['direct', 'group', 'request', 'support'], default: 'direct' })
  @IsOptional()
  @IsIn(['direct', 'group', 'request', 'support'])
  type?: 'direct' | 'group' | 'request' | 'support';

  @ApiPropertyOptional({ example: 'Blood request support' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({ example: 'blood_request' })
  @IsOptional()
  @IsString()
  contextType?: string;

  @ApiPropertyOptional({ example: 42 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  contextId?: number;

  @ApiProperty({ type: [ChatParticipantInputDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ChatParticipantInputDto)
  participants!: ChatParticipantInputDto[];
}
