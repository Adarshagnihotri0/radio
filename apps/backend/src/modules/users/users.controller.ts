import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req: AuthenticatedRequest) {
    return this.usersService.findById(req.user.sub);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(@Request() req: AuthenticatedRequest, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(req.user.sub, dto);
  }

  @Put('me/location')
  @ApiOperation({ summary: 'Update current user location' })
  async updateLocation(@Request() req: AuthenticatedRequest, @Body() dto: UpdateLocationDto) {
    await this.usersService.updateLocation(req.user.sub, dto);
    return { ok: true };
  }
}
