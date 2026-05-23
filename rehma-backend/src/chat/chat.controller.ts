import { Body, Controller, Get, Param, Patch, Post, Query, Request, StreamableFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { ChatUploadFile } from './chat.service';
import { CreateChatConversationDto } from './dto/create-chat-conversation.dto';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import { ListChatMessagesDto } from './dto/list-chat-messages.dto';
import { UpdateChatParticipantStateDto } from './dto/update-chat-participant-state.dto';
import { MarkChatReadDto } from './dto/mark-chat-read.dto';
import { ChatGateway } from './chat.gateway';

@ApiTags('Chat')
@ApiBearerAuth('jwt')
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List chat conversations for the authenticated account' })
  findConversations(@Request() req: any) {
    return this.chatService.listConversations({ role: req.user.role, userId: Number(req.user.sub) });
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Create a chat conversation' })
  @ApiBody({ type: CreateChatConversationDto })
  createConversation(@Request() req: any, @Body() dto: CreateChatConversationDto) {
    const conversation = this.chatService.createConversation({ role: req.user.role, userId: Number(req.user.sub) }, dto);
    this.chatGateway.broadcastConversation(conversation);
    return conversation;
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a chat conversation by ID' })
  findConversation(@Param('id') id: string, @Request() req: any) {
    return this.chatService.getConversation(Number(id), { role: req.user.role, userId: Number(req.user.sub) });
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'List messages in a conversation' })
  findMessages(@Param('id') id: string, @Request() req: any, @Query() query: ListChatMessagesDto) {
    return this.chatService.listMessages(Number(id), { role: req.user.role, userId: Number(req.user.sub) }, query);
  }

  @Post('conversations/:id/messages')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({ summary: 'Send a message with optional attachments' })
  @ApiBody({ type: SendChatMessageDto })
  async sendMessage(@Param('id') id: string, @Request() req: any, @Body() dto: SendChatMessageDto, @UploadedFiles() files: ChatUploadFile[] = []) {
    const message = await this.chatService.sendMessage(Number(id), { role: req.user.role, userId: Number(req.user.sub) }, dto, files ?? []);
    this.chatGateway.broadcastMessage(Number(id), message);
    this.chatGateway.broadcastUnreadCount(req.user.role, Number(req.user.sub), this.chatService.getUnreadCount({ role: req.user.role, userId: Number(req.user.sub) }).unreadCount);
    return message;
  }

  @Patch('conversations/:id/read')
  @ApiOperation({ summary: 'Mark conversation as read' })
  @ApiBody({ type: MarkChatReadDto })
  markAsRead(@Param('id') id: string, @Request() req: any, @Body() dto: MarkChatReadDto) {
    const result = this.chatService.markAsRead(Number(id), { role: req.user.role, userId: Number(req.user.sub) }, dto);
    this.chatGateway.broadcastUnreadCount(req.user.role, Number(req.user.sub), result.unreadCount);
    this.chatGateway.broadcastConversation(result.conversation);
    return result;
  }

  @Patch('conversations/:id/archive')
  @ApiOperation({ summary: 'Archive or unarchive the conversation for the current account' })
  @ApiBody({ type: UpdateChatParticipantStateDto })
  archiveConversation(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateChatParticipantStateDto) {
    const conversation = this.chatService.updateParticipantState(Number(id), { role: req.user.role, userId: Number(req.user.sub) }, dto);
    this.chatGateway.broadcastConversation(conversation);
    return conversation;
  }

  @Patch('conversations/:id/mute')
  @ApiOperation({ summary: 'Mute or unmute the conversation for the current account' })
  @ApiBody({ type: UpdateChatParticipantStateDto })
  muteConversation(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateChatParticipantStateDto) {
    const conversation = this.chatService.updateParticipantState(Number(id), { role: req.user.role, userId: Number(req.user.sub) }, dto);
    this.chatGateway.broadcastConversation(conversation);
    return conversation;
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread chat count for the authenticated account' })
  getUnreadCount(@Request() req: any) {
    return this.chatService.getUnreadCount({ role: req.user.role, userId: Number(req.user.sub) });
  }

  @Get('attachments/:id')
  @ApiOperation({ summary: 'Download a chat attachment' })
  downloadAttachment(@Param('id') id: string) {
    const attachment = this.chatService.getAttachment(Number(id));
    return new StreamableFile(createReadStream(attachment.filePath), {
      type: attachment.attachment.mimeType,
      disposition: `inline; filename="${attachment.attachment.originalName.replace(/"/g, '')}"`,
    });
  }
}
