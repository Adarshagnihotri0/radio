import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

export interface UserPresence {
  userId: string;
  username: string;
  lat?: number;
  lng?: number;
  socketId: string;
  online: boolean;
  channelId?: string;
}

@Injectable()
export class PresenceService {
  constructor(private readonly redisService: RedisService) {}

  async setPresence(userId: string, presence: UserPresence, ttl = 60): Promise<void> {
    await this.redisService.setUserPresence(userId, presence as unknown as Record<string, unknown>, ttl);
  }

  async getPresence(userId: string): Promise<UserPresence | null> {
    const data = await this.redisService.getUserPresence(userId);
    return data as unknown as UserPresence | null;
  }

  async removePresence(userId: string): Promise<void> {
    await this.redisService.removeUserPresence(userId);
  }

  async isOnline(userId: string): Promise<boolean> {
    const presence = await this.getPresence(userId);
    return presence?.online === true;
  }
}
