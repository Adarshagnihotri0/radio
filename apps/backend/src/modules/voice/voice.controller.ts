import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { VoiceService } from './voice.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('voice')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Get('ice-servers')
  @ApiOperation({ summary: 'Get ICE server configuration for WebRTC' })
  getIceServers() {
    return { iceServers: this.voiceService.getIceServers() };
  }
}
