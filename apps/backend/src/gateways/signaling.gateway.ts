import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { ChannelsService } from '../modules/channels/channels.service';
import { JwtPayload } from '../modules/auth/interfaces/jwt-payload.interface';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

interface WebRtcSessionDescription {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

interface WebRtcIceCandidate {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

interface RtcOfferPayload {
  to: string;
  sdp: WebRtcSessionDescription;
}

interface RtcAnswerPayload {
  to: string;
  sdp: WebRtcSessionDescription;
}

interface RtcIcePayload {
  to: string;
  candidate: WebRtcIceCandidate;
}

interface PttPayload {
  channelId: string;
}

type MediaProvider = 'youtube';

interface MediaState {
  provider: MediaProvider;
  videoId: string;
  isPlaying: boolean;
  positionSec: number;
  playbackRate: number;
  sequence: number;
  updatedAtMs: number;
  updatedByUserId: string;
}

interface MediaSetPayload {
  channelId: string;
  provider: MediaProvider;
  videoId: string;
  positionSec?: number;
  isPlaying?: boolean;
  playbackRate?: number;
  sequence?: number;
}

interface MediaControlPayload {
  channelId: string;
  positionSec: number;
  playbackRate?: number;
  sequence?: number;
}

interface MediaStatePayload {
  channelId: string;
  positionSec: number;
  isPlaying: boolean;
  playbackRate?: number;
  sequence?: number;
}

interface MediaAckPayload {
  channelId: string;
  sequence: number;
  accepted: boolean;
  serverUpdatedAt: number;
  reason?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/signaling',
  transports: ['websocket', 'polling'],
})
export class SignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SignalingGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redisService: RedisService,
    private readonly channelsService: ChannelsService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token =
        (client.handshake.auth as Record<string, string>).token ??
        (client.handshake.headers.authorization ?? '').replace('Bearer ', '');

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.secret'),
      });

      client.userId = payload.sub;
      client.username = payload.username;

      // Mark user online in Redis
      await this.redisService.setUserPresence(
        payload.sub,
        { userId: payload.sub, username: payload.username, socketId: client.id, online: true },
        120,
      );

      this.logger.log(`Client connected: ${payload.username} (${client.id})`);
    } catch {
      this.logger.warn(`Unauthorized connection attempt: ${client.id}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    if (!client.userId) return;

    this.logger.log(`Client disconnected: ${client.username ?? client.id}`);

    // Release any held speaker locks (scan rooms the socket was in)
    const rooms = Array.from(client.rooms).filter((r) => r !== client.id);
    for (const room of rooms) {
      const channelId = room.replace('channel:', '');
      await this.redisService.releaseSpeakerLock(channelId, client.userId);
      this.server.to(room).emit('user:silent', { userId: client.userId, channelId });
      const hostReleased = await this.releaseMediaHostIfOwner(channelId, client.userId);
      if (hostReleased) {
        this.server.to(room).emit('room:media:host_left', { channelId });
      }
      await this.channelsService.incrementActiveUsers(channelId, -1);
    }

    await this.redisService.removeUserPresence(client.userId);
  }

  // --- Channel join / leave ---

  @SubscribeMessage('channel:join')
  async handleChannelJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { channelId: string },
  ): Promise<void> {
    this.assertAuth(client);
    const { channelId } = payload;
    const channel = await this.channelsService.findById(channelId).catch(() => null);
    if (!channel || !channel.isActive) {
      client.emit('channel:join_failed', { channelId, reason: 'Channel not found' });
      return;
    }

    const targetRoom = `channel:${channelId}`;
    const alreadyInRoom = client.rooms.has(targetRoom);
    if (alreadyInRoom) {
      client.emit('channel:joined', { channelId });
      return;
    }

    const currentUsers = typeof channel.activeUsers === 'number' ? channel.activeUsers : 0;
    if (currentUsers >= channel.maxUsers) {
      client.emit('channel:join_failed', { channelId, reason: 'Channel is full' });
      return;
    }

    // A user can stay in only one channel at a time.
    for (const room of Array.from(client.rooms)) {
      if (!room.startsWith('channel:') || room === targetRoom) {
        continue;
      }

      const previousChannelId = room.replace('channel:', '');
      await this.redisService.releaseSpeakerLock(previousChannelId, client.userId!);
      const hostReleased = await this.releaseMediaHostIfOwner(previousChannelId, client.userId!);
      if (hostReleased) {
        this.server.to(room).emit('room:media:host_left', { channelId: previousChannelId });
      }

      await client.leave(room);
      await this.channelsService.incrementActiveUsers(previousChannelId, -1);

      this.server.to(room).emit('user:left', {
        userId: client.userId,
        channelId: previousChannelId,
      });
    }

    await client.join(targetRoom);
    await this.channelsService.incrementActiveUsers(channelId, 1);

    const members = await this.getChannelMembers(channelId);
    this.server.to(`channel:${channelId}`).emit('channel:users', { channelId, users: members });

    client.to(`channel:${channelId}`).emit('user:joined', {
      userId: client.userId,
      username: client.username,
      channelId,
    });

    const hostUserId = await this.redisService.get(this.mediaHostKey(channelId));
    const mediaState = await this.getMediaState(channelId);
    if (mediaState) {
      client.emit('room:media:state', { channelId, hostUserId, mediaState });
    }
    client.emit('channel:joined', { channelId });

    this.logger.log(`${client.username ?? 'unknown'} joined channel ${channelId}`);
  }

  @SubscribeMessage('channel:leave')
  async handleChannelLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { channelId: string },
  ): Promise<void> {
    this.assertAuth(client);
    const { channelId } = payload;

    await this.redisService.releaseSpeakerLock(channelId, client.userId!);
    const hostReleased = await this.releaseMediaHostIfOwner(channelId, client.userId!);
    if (hostReleased) {
      this.server.to(`channel:${channelId}`).emit('room:media:host_left', { channelId });
    }
    await client.leave(`channel:${channelId}`);
    await this.channelsService.incrementActiveUsers(channelId, -1);

    this.server.to(`channel:${channelId}`).emit('user:left', {
      userId: client.userId,
      channelId,
    });
  }

  // --- PTT (Push-to-Talk) ---

  @SubscribeMessage('ptt:start')
  async handlePttStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: PttPayload,
  ): Promise<void> {
    this.assertAuth(client);
    const { channelId } = payload;
    const speakerLockTtl = this.config.get<number>('redis.speakerLockTtl', 30);

    const acquired = await this.redisService.acquireSpeakerLock(
      channelId,
      client.userId!,
      speakerLockTtl,
    );

    if (acquired) {
      this.server.to(`channel:${channelId}`).emit('user:speaking', {
        userId: client.userId,
        username: client.username,
        channelId,
      });
    } else {
      // Channel is busy — notify requester
      const currentSpeaker = await this.redisService.getCurrentSpeaker(channelId);
      client.emit('ptt:busy', { channelId, speakerId: currentSpeaker });
    }
  }

  @SubscribeMessage('ptt:stop')
  async handlePttStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: PttPayload,
  ): Promise<void> {
    this.assertAuth(client);
    const { channelId } = payload;

    const released = await this.redisService.releaseSpeakerLock(channelId, client.userId!);

    if (released) {
      this.server.to(`channel:${channelId}`).emit('user:silent', {
        userId: client.userId,
        channelId,
      });
    }
  }

  // --- Synchronized media watch-party ---

  @SubscribeMessage('room:media:set')
  async handleMediaSet(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MediaSetPayload,
  ): Promise<void> {
    this.assertAuth(client);
    this.assertInChannel(client, payload.channelId);

    if (payload.provider !== 'youtube') {
      throw new WsException('Unsupported media provider');
    }
    if (!payload.videoId || payload.videoId.trim().length < 6) {
      throw new WsException('Invalid video id');
    }

    const channelId = payload.channelId;
    const hostKey = this.mediaHostKey(channelId);
    const existingHost = await this.redisService.get(hostKey);

    if (existingHost && existingHost !== client.userId) {
      client.emit('room:media:host_taken', { channelId, hostUserId: existingHost });
      const rejectedAck: MediaAckPayload = {
        channelId,
        sequence: this.sanitizeSequence(payload.sequence, 1),
        accepted: false,
        serverUpdatedAt: Date.now(),
        reason: 'host_taken',
      };
      client.emit('room:media:ack', rejectedAck);
      return;
    }

    if (!existingHost) {
      await this.redisService.set(hostKey, client.userId!, 60 * 60 * 12);
    }

    const mediaState: MediaState = {
      provider: 'youtube',
      videoId: payload.videoId.trim(),
      isPlaying: payload.isPlaying ?? false,
      positionSec: this.sanitizePosition(payload.positionSec),
      playbackRate: this.sanitizeRate(payload.playbackRate),
      sequence: this.sanitizeSequence(payload.sequence, 1),
      updatedAtMs: Date.now(),
      updatedByUserId: client.userId!,
    };

    await this.setMediaState(channelId, mediaState);

    const hostUserId = await this.redisService.get(hostKey);
    this.server.to(`channel:${channelId}`).emit('room:media:state', {
      channelId,
      hostUserId,
      mediaState,
    });

    const ack: MediaAckPayload = {
      channelId,
      sequence: mediaState.sequence,
      accepted: true,
      serverUpdatedAt: mediaState.updatedAtMs,
    };
    client.emit('room:media:ack', ack);
  }

  @SubscribeMessage('room:media:play')
  async handleMediaPlay(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MediaControlPayload,
  ): Promise<void> {
    await this.updateHostMediaState(client, payload.channelId, {
      positionSec: payload.positionSec,
      isPlaying: true,
      playbackRate: payload.playbackRate,
      sequence: payload.sequence,
    });
  }

  @SubscribeMessage('room:media:pause')
  async handleMediaPause(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MediaControlPayload,
  ): Promise<void> {
    await this.updateHostMediaState(client, payload.channelId, {
      positionSec: payload.positionSec,
      isPlaying: false,
      playbackRate: payload.playbackRate,
      sequence: payload.sequence,
    });
  }

  @SubscribeMessage('room:media:seek')
  async handleMediaSeek(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MediaControlPayload,
  ): Promise<void> {
    await this.updateHostMediaState(client, payload.channelId, {
      positionSec: payload.positionSec,
      playbackRate: payload.playbackRate,
      sequence: payload.sequence,
    });
  }

  @SubscribeMessage('room:media:state')
  async handleMediaState(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MediaStatePayload,
  ): Promise<void> {
    await this.updateHostMediaState(client, payload.channelId, {
      positionSec: payload.positionSec,
      isPlaying: payload.isPlaying,
      playbackRate: payload.playbackRate,
      sequence: payload.sequence,
    });
  }

  // --- WebRTC Signaling ---

  @SubscribeMessage('rtc:offer')
  handleRtcOffer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: RtcOfferPayload,
  ): void {
    this.assertAuth(client);
    this.server.to(payload.to).emit('rtc:offer', {
      from: client.id,
      sdp: payload.sdp,
    });
  }

  @SubscribeMessage('rtc:answer')
  handleRtcAnswer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: RtcAnswerPayload,
  ): void {
    this.assertAuth(client);
    this.server.to(payload.to).emit('rtc:answer', {
      from: client.id,
      sdp: payload.sdp,
    });
  }

  @SubscribeMessage('rtc:ice')
  handleIceCandidate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: RtcIcePayload,
  ): void {
    this.assertAuth(client);
    this.server.to(payload.to).emit('rtc:ice', {
      from: client.id,
      candidate: payload.candidate,
    });
  }

  // --- Location update ---

  @SubscribeMessage('location:update')
  async handleLocationUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { lat: number; lng: number },
  ): Promise<void> {
    this.assertAuth(client);

    await this.redisService.setUserPresence(
      client.userId!,
      {
        userId: client.userId,
        username: client.username,
        lat: payload.lat,
        lng: payload.lng,
        socketId: client.id,
        online: true,
      },
      120,
    );

    // Emit proximity update back to this client (nearby channels)
    client.emit('presence:location_ack', { ok: true });
  }

  // --- Helpers ---

  private assertAuth(client: AuthenticatedSocket): void {
    if (!client.userId) {
      throw new WsException('Unauthorized');
    }
  }

  private assertInChannel(client: AuthenticatedSocket, channelId: string): void {
    if (!client.rooms.has(`channel:${channelId}`)) {
      throw new WsException('Join channel before media control');
    }
  }

  private async getChannelMembers(channelId: string): Promise<string[]> {
    const room = this.server.sockets.adapter.rooms.get(`channel:${channelId}`);
    if (!room) return [];
    return Array.from(room);
  }

  private mediaHostKey(channelId: string): string {
    return `radius:channel:${channelId}:media:host`;
  }

  private mediaStateKey(channelId: string): string {
    return `radius:channel:${channelId}:media:state`;
  }

  private sanitizePosition(value: unknown): number {
    const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    return Math.max(0, numeric);
  }

  private sanitizeRate(value: unknown): number {
    const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 1;
    return Math.min(2, Math.max(0.25, numeric));
  }

  private sanitizeSequence(value: unknown, fallback: number): number {
    const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
    return Math.max(1, numeric);
  }

  private async setMediaState(channelId: string, mediaState: MediaState): Promise<void> {
    await this.redisService.set(
      this.mediaStateKey(channelId),
      JSON.stringify(mediaState),
      60 * 60 * 12,
    );
  }

  private async getMediaState(channelId: string): Promise<MediaState | null> {
    const raw = await this.redisService.get(this.mediaStateKey(channelId));
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<MediaState>;
      if (!parsed.videoId || !parsed.provider) {
        return null;
      }

      return {
        provider: parsed.provider,
        videoId: parsed.videoId,
        isPlaying: Boolean(parsed.isPlaying),
        positionSec: this.sanitizePosition(parsed.positionSec),
        playbackRate: this.sanitizeRate(parsed.playbackRate),
        sequence: this.sanitizeSequence(parsed.sequence, 0),
        updatedAtMs:
          typeof parsed.updatedAtMs === 'number' && Number.isFinite(parsed.updatedAtMs)
            ? parsed.updatedAtMs
            : Date.now(),
        updatedByUserId: parsed.updatedByUserId ?? 'unknown',
      };
    } catch {
      return null;
    }
  }

  private async releaseMediaHostIfOwner(channelId: string, userId: string): Promise<boolean> {
    const hostKey = this.mediaHostKey(channelId);
    const currentHost = await this.redisService.get(hostKey);

    if (currentHost === userId) {
      await this.redisService.del(hostKey);
      return true;
    }

    return false;
  }

  private async updateHostMediaState(
    client: AuthenticatedSocket,
    channelId: string,
    patch: { positionSec?: number; isPlaying?: boolean; playbackRate?: number; sequence?: number },
  ): Promise<void> {
    this.assertAuth(client);
    this.assertInChannel(client, channelId);

    const hostUserId = await this.redisService.get(this.mediaHostKey(channelId));
    if (!hostUserId || hostUserId !== client.userId) {
      client.emit('room:media:not_host', { channelId, hostUserId });
      const rejectedAck: MediaAckPayload = {
        channelId,
        sequence: this.sanitizeSequence(patch.sequence, 1),
        accepted: false,
        serverUpdatedAt: Date.now(),
        reason: 'not_host',
      };
      client.emit('room:media:ack', rejectedAck);
      return;
    }

    const existing = await this.getMediaState(channelId);
    if (!existing) {
      throw new WsException('No active media set for channel');
    }

    const nextSequence = this.sanitizeSequence(patch.sequence, existing.sequence + 1);
    if (nextSequence <= existing.sequence) {
      const rejectedAck: MediaAckPayload = {
        channelId,
        sequence: nextSequence,
        accepted: false,
        serverUpdatedAt: Date.now(),
        reason: 'stale_sequence',
      };
      client.emit('room:media:ack', rejectedAck);
      return;
    }

    const mediaState: MediaState = {
      ...existing,
      positionSec:
        patch.positionSec === undefined
          ? existing.positionSec
          : this.sanitizePosition(patch.positionSec),
      isPlaying: patch.isPlaying === undefined ? existing.isPlaying : patch.isPlaying,
      playbackRate:
        patch.playbackRate === undefined
          ? existing.playbackRate
          : this.sanitizeRate(patch.playbackRate),
      sequence: nextSequence,
      updatedAtMs: Date.now(),
      updatedByUserId: client.userId!,
    };

    await this.setMediaState(channelId, mediaState);
    this.logger.debug(
      `media-state channel=${channelId} seq=${mediaState.sequence} pos=${mediaState.positionSec.toFixed(3)} playing=${mediaState.isPlaying}`,
    );
    this.server.to(`channel:${channelId}`).emit('room:media:state', {
      channelId,
      hostUserId,
      mediaState,
    });

    const ack: MediaAckPayload = {
      channelId,
      sequence: mediaState.sequence,
      accepted: true,
      serverUpdatedAt: mediaState.updatedAtMs,
    };
    client.emit('room:media:ack', ack);
  }

  /**
   * Broadcast to a channel from outside (e.g., from a service).
   */
  broadcastToChannel(channelId: string, event: string, data: unknown): void {
    this.server.to(`channel:${channelId}`).emit(event, data);
  }
}
