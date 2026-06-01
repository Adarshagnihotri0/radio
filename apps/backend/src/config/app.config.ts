import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
  throttleTtl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
}));
