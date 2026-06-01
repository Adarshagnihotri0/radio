import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { WinstonLoggerService } from './common/logger/winston-logger.service';

async function bootstrap(): Promise<void> {
  const logger = new WinstonLoggerService();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(logger);

  // Security
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());

  // CORS
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Versioning
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Swagger
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Radius API')
      .setDescription('Geo-fenced tactical push-to-talk platform API')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addTag('auth', 'Authentication endpoints')
      .addTag('channels', 'Channel management')
      .addTag('users', 'User management')
      .addTag('voice', 'Voice session management')
      .addTag('geo', 'Geospatial queries')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    logger.log(`Swagger docs: http://localhost:${process.env.PORT ?? 3000}/api`);
  }

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  logger.log(`Radius backend running on port ${port}`);
}

void bootstrap();
