import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GeoService } from './geo.service';
import { NearbyUsersDto } from './dto/nearby-users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('geo')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('nearby-users')
  @ApiOperation({ summary: 'Find nearby online users' })
  async nearbyUsers(@Query() dto: NearbyUsersDto) {
    return this.geoService.findNearbyUsers(dto.latitude, dto.longitude, dto.radiusKm * 1000);
  }
}
