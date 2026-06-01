import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { Channel, ChannelSchema } from '../../database/schemas/channel.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Channel.name, schema: ChannelSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
