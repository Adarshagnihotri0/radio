import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { WinstonModule } from 'nest-winston';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { VoiceModule } from './modules/voice/voice.module';
import { GeoModule } from './modules/geo/geo.module';
import { SignalingModule } from './modules/signaling/signaling.module';
import { PresenceModule } from './modules/presence/presence.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { RedisModule } from './redis/redis.module';
import { HealthController } from './health/health.controller';
import { winstonConfig } from './config/winston.config';
import appConfig from './config/app.config';
import dbConfig from './config/db.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import webrtcConfig from './config/webrtc.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, jwtConfig, redisConfig, webrtcConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // Logging
    WinstonModule.forRoot(winstonConfig),

    // Database
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('db.uri'),
        connectionFactory: (connection: { plugin: (fn: unknown) => void }) => {
          return connection;
        },
      }),
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('app.throttleTtl', 60) * 1000,
          limit: config.get<number>('app.throttleLimit', 100),
        },
      ],
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Health checks
    TerminusModule,

    // Redis
    RedisModule,

    // Feature modules
    AuthModule,
    UsersModule,
    ChannelsModule,
    VoiceModule,
    GeoModule,
    SignalingModule,
    PresenceModule,
    NotificationsModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
