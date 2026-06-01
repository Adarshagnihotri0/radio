import { Module } from '@nestjs/common';
import { SignalingGateway } from '../../gateways/signaling.gateway';
import { ChannelsModule } from '../channels/channels.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, ChannelsModule],
  providers: [SignalingGateway],
  exports: [SignalingGateway],
})
export class SignalingModule {}
