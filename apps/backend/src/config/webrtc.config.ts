import { registerAs } from '@nestjs/config';

export default registerAs('webrtc', () => ({
  stunUrls: (
    process.env.STUN_URLS ?? 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'
  ).split(','),
  turnUrl: process.env.TURN_URL ?? null,
  turnUsername: process.env.TURN_USERNAME ?? null,
  turnCredential: process.env.TURN_CREDENTIAL ?? null,
}));
