// ────────────────────────────────────────────────────────────
// Geo types
// ────────────────────────────────────────────────────────────

export interface GeoPoint {
  type: 'Point';
  coordinates: [longitude: number, latitude: number];
}

export interface Coordinates {
  lat: number;
  lng: number;
}

// ────────────────────────────────────────────────────────────
// User
// ────────────────────────────────────────────────────────────

export interface User {
  _id: string;
  username: string;
  email: string;
  avatar: string | null;
  location: GeoPoint;
  activeChannel: string | null;
  online: boolean;
  lastSeen: string | null;
  joinedChannels: string[];
  createdAt: string;
  updatedAt: string;
}

// ────────────────────────────────────────────────────────────
// Channel
// ────────────────────────────────────────────────────────────

export interface Channel {
  _id: string;
  name: string;
  description: string;
  frequency: string;
  center: GeoPoint;
  radiusKm: number;
  createdBy: string | Partial<User>;
  activeUsers: number;
  maxUsers: number;
  encrypted: boolean;
  isPrivate: boolean;
  isTemporary: boolean;
  expiresAt: string | null;
  emergencyMode: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ────────────────────────────────────────────────────────────
// Voice Session
// ────────────────────────────────────────────────────────────

export interface VoiceSession {
  _id: string;
  channelId: string;
  speakerId: string | Partial<User>;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
}

// ────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
  username: string;
}

export interface JwtPayload {
  sub: string;
  username: string;
  iat: number;
  exp: number;
}

// ────────────────────────────────────────────────────────────
// WebSocket events
// ────────────────────────────────────────────────────────────

// Client → Server
export interface ClientEvents {
  'channel:join': { channelId: string };
  'channel:leave': { channelId: string };
  'ptt:start': { channelId: string };
  'ptt:stop': { channelId: string };
  'location:update': { lat: number; lng: number };
  'rtc:offer': { to: string; sdp: RTCSessionDescriptionInit };
  'rtc:answer': { to: string; sdp: RTCSessionDescriptionInit };
  'rtc:ice': { to: string; candidate: RTCIceCandidateInit };
}

// Server → Client
export interface ServerEvents {
  'user:speaking': { userId: string; username: string; channelId: string };
  'user:silent': { userId: string; channelId: string };
  'user:joined': { userId: string; username: string; channelId: string };
  'user:left': { userId: string; channelId: string };
  'channel:users': { channelId: string; users: string[] };
  'ptt:busy': { channelId: string; speakerId: string };
  'proximity:update': { channels: Channel[] };
  'rtc:offer': { from: string; sdp: RTCSessionDescriptionInit };
  'rtc:answer': { from: string; sdp: RTCSessionDescriptionInit };
  'rtc:ice': { from: string; candidate: RTCIceCandidateInit };
  'presence:location_ack': { ok: boolean };
}

// ────────────────────────────────────────────────────────────
// API Responses
// ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}
