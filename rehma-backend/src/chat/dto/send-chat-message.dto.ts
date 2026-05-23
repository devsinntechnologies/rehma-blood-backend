import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class SendChatMessageDto {
  @ApiPropertyOptional({ example: 'I can help with this request.' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ enum: ['text', 'voice', 'image', 'video', 'file', 'mixed'], default: 'text' })
  @IsOptional()
  @IsIn(['text', 'voice', 'image', 'video', 'file', 'mixed'])
  messageType?: 'text' | 'voice' | 'image' | 'video' | 'file' | 'mixed';

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  replyToMessageId?: number;
}
