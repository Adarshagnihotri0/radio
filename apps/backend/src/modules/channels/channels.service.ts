import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Channel, ChannelDocument } from '../../database/schemas/channel.schema';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { NearbyChannelsDto } from './dto/nearby-channels.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectModel(Channel.name) private readonly channelModel: Model<ChannelDocument>,
  ) {}

  async create(dto: CreateChannelDto, userId: string): Promise<ChannelDocument> {
    return this.channelModel.create({
      ...dto,
      createdBy: new Types.ObjectId(userId),
      center: { type: 'Point', coordinates: [dto.longitude, dto.latitude] },
    });
  }

  async findAll(pagination: PaginationDto): Promise<{ data: ChannelDocument[]; total: number }> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.channelModel
        .find({ isActive: true })
        .sort({ activeUsers: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'username avatar')
        .lean()
        .exec(),
      this.channelModel.countDocuments({ isActive: true }),
    ]);

    return { data: data as unknown as ChannelDocument[], total };
  }

  async findById(id: string): Promise<ChannelDocument> {
    const channel = await this.channelModel
      .findById(id)
      .populate('createdBy', 'username avatar')
      .exec();

    if (!channel) {
      throw new NotFoundException(`Channel ${id} not found`);
    }

    return channel;
  }

  async findNearby(dto: NearbyChannelsDto): Promise<ChannelDocument[]> {
    const radiusMeters = (dto.radiusKm ?? 25) * 1000;

    return this.channelModel
      .find({
        isActive: true,
        center: {
          $near: {
            $geometry: { type: 'Point', coordinates: [dto.longitude, dto.latitude] },
            $maxDistance: radiusMeters,
          },
        },
      })
      .limit(dto.limit ?? 50)
      .lean()
      .exec() as unknown as Promise<ChannelDocument[]>;
  }

  async update(id: string, dto: UpdateChannelDto, userId: string): Promise<ChannelDocument> {
    const channel = await this.findById(id);

    if (this.getCreatorId(channel.createdBy) !== userId) {
      throw new ForbiddenException('Only the channel creator can update it');
    }

    const updateData: Partial<Channel> & { center?: { type: 'Point'; coordinates: [number, number] } } = { ...dto };

    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      updateData.center = { type: 'Point', coordinates: [dto.longitude, dto.latitude] };
    }

    return this.channelModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('createdBy', 'username avatar')
      .exec() as Promise<ChannelDocument>;
  }

  async remove(id: string, userId: string): Promise<void> {
    const channel = await this.findById(id);

    if (this.getCreatorId(channel.createdBy) !== userId) {
      throw new ForbiddenException('Only the channel creator can delete it');
    }

    await this.channelModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }

  async incrementActiveUsers(channelId: string, delta: 1 | -1): Promise<void> {
    await this.channelModel
      .findByIdAndUpdate(
        channelId,
        [
          {
            $set: {
              activeUsers: {
                $max: [0, { $add: ['$activeUsers', delta] }],
              },
            },
          },
        ],
      )
      .exec();
  }

  async isUserInRadius(channelId: string, userLat: number, userLng: number): Promise<boolean> {
    const channel = await this.channelModel.findById(channelId).lean().exec();
    if (!channel) return false;

    const [chanLng, chanLat] = channel.center.coordinates;
    const distanceM = this.haversineMeters(userLat, userLng, chanLat, chanLng);
    return distanceM <= channel.radiusKm * 1000;
  }

  private haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private getCreatorId(createdBy: unknown): string {
    if (createdBy instanceof Types.ObjectId) {
      return createdBy.toString();
    }

    if (createdBy && typeof createdBy === 'object') {
      const candidate = createdBy as { _id?: unknown; toString?: () => string };
      if (candidate._id instanceof Types.ObjectId) {
        return candidate._id.toString();
      }
      if (typeof candidate._id === 'string') {
        return candidate._id;
      }
      if (typeof candidate.toString === 'function') {
        const value = candidate.toString();
        if (value && value !== '[object Object]') {
          return value;
        }
      }
    }

    if (typeof createdBy === 'string') {
      return createdBy;
    }

    return '';
  }
}
