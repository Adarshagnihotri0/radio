import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  // --- Generic ---

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  // --- Speaker Lock ---

  /**
   * Atomically acquire the PTT speaker lock for a channel.
   * Returns true if this user acquired the lock, false if someone else holds it.
   */
  async acquireSpeakerLock(channelId: string, userId: string, ttlSeconds = 30): Promise<boolean> {
    const key = `radius:channel:${channelId}:speaker`;
    // NX = only set if Not eXists
    const result = await this.client.set(key, userId, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseSpeakerLock(channelId: string, userId: string): Promise<boolean> {
    const key = `radius:channel:${channelId}:speaker`;
    const current = await this.client.get(key);
    if (current === userId) {
      await this.client.del(key);
      return true;
    }
    return false;
  }

  async getCurrentSpeaker(channelId: string): Promise<string | null> {
    return this.client.get(`radius:channel:${channelId}:speaker`);
  }

  // --- Presence ---

  async setUserPresence(userId: string, data: Record<string, unknown>, ttlSeconds = 60): Promise<void> {
    const key = `radius:presence:${userId}`;
    await this.client.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  }

  async getUserPresence(userId: string): Promise<Record<string, unknown> | null> {
    const raw = await this.client.get(`radius:presence:${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  }

  async removeUserPresence(userId: string): Promise<void> {
    await this.client.del(`radius:presence:${userId}`);
  }

  // --- Sets (channel members) ---

  async addToSet(key: string, ...members: string[]): Promise<void> {
    await this.client.sadd(key, ...members);
  }

  async removeFromSet(key: string, member: string): Promise<void> {
    await this.client.srem(key, member);
  }

  async getSetMembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async getSetSize(key: string): Promise<number> {
    return this.client.scard(key);
  }

  // --- PubSub ---

  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }

  getSubscriberClient(): Redis {
    // Return a dedicated subscriber instance (ioredis requires separate connection)
    return this.client.duplicate();
  }

  // --- Hashes ---

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.client.hdel(key, field);
  }
}
