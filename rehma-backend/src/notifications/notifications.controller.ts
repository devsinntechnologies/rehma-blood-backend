import { Controller, Get, Param, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('jwt')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the authenticated account' })
  findAll(@Request() req: any) {
    return this.notificationsService.findAll({ role: req.user.role, userId: Number(req.user.sub) });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count for the authenticated account' })
  getUnreadCount(@Request() req: any) {
    return {
      unreadCount: this.notificationsService.getUnreadCount({ role: req.user.role, userId: Number(req.user.sub) }),
    };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.notificationsService.markAsRead(Number(id), { role: req.user.role, userId: Number(req.user.sub) });
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead({ role: req.user.role, userId: Number(req.user.sub) });
  }
}