import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';

@ApiTags('Superadmin Auth')
@ApiBearerAuth('jwt')
@Controller('superadmin')
@UseGuards(JwtAuthGuard)
export class SuperAdminProfileController {
  @Get('profile')
  @ApiOperation({ summary: 'Get authenticated superadmin profile' })
  getProfile(@Request() req: any) {
    return {
      id: req.user.sub,
      email: req.user.email,
      role: req.user.role,
    };
  }
}
