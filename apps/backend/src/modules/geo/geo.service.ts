import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { Channel, ChannelDocument } from '../../database/schemas/channel.schema';

@Injectable()
export class GeoService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Channel.name) private readonly channelModel: Model<ChannelDocument>,
  ) {}

  /**
   * Find users within a given radius using MongoDB $near (2dsphere).
   */
  async findNearbyUsers(
    lat: number,
    lng: number,
    radiusMeters: number,
    excludeUserId?: string,
  ): Promise<UserDocument[]> {
    const filter: Record<string, unknown> = {
      online: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusMeters,
        },
      },
    };

    if (excludeUserId) {
      filter['_id'] = { $ne: excludeUserId };
    }

    return this.userModel
      .find(filter)
      .select('username avatar location online activeChannel')
      .limit(200)
      .lean()
      .exec() as unknown as Promise<UserDocument[]>;
  }

  /**
   * Find channels whose geo-fence center is within radiusKm of the given point.
   */
  async findNearbyChannels(
    lat: number,
    lng: number,
    radiusKm: number,
    limit = 50,
  ): Promise<ChannelDocument[]> {
    return this.channelModel
      .find({
        isActive: true,
        center: {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: radiusKm * 1000,
          },
        },
      })
      .limit(limit)
      .lean()
      .exec() as unknown as Promise<ChannelDocument[]>;
  }

  /**
   * Update a user's stored location (for geo queries).
   * Called on each location:update socket event.
   */
  async updateUserLocation(userId: string, lat: number, lng: number): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        location: { type: 'Point', coordinates: [lng, lat] },
      })
      .exec();
  }
}
