import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD ?? undefined,
  speakerLockTtl: 30, // seconds
  presenceTtl: 60, // seconds
  channelCacheTtl: 300, // seconds
}));
