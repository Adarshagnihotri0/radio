import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { Channel, ChannelSchema } from '../../database/schemas/channel.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Channel.name, schema: ChannelSchema },
    ]),
  ],
  controllers: [GeoController],
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}
