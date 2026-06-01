import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from './redis.constants';

export { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const url = config.getOrThrow<string>('redis.url');
        const client = new Redis(url, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: false,
          lazyConnect: true,
        });

        client.on('error', (err: Error) => {
          console.error('[Redis] Connection error:', err.message);
        });

        client.on('connect', () => {
          console.warn('[Redis] Connected');
        });

        return client;
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
