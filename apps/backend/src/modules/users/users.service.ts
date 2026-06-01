import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateLocation(id: string, dto: UpdateLocationDto): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, {
        location: { type: 'Point', coordinates: [dto.longitude, dto.latitude] },
      })
      .exec();
  }

  async setOnline(id: string, online: boolean): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { online, lastSeen: online ? undefined : new Date() })
      .exec();
  }
}
