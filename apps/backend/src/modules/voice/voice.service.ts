import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VoiceSession, VoiceSessionDocument } from '../../database/schemas/voice-session.schema';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VoiceService {
  constructor(
    @InjectModel(VoiceSession.name)
    private readonly voiceSessionModel: Model<VoiceSessionDocument>,
    private readonly config: ConfigService,
  ) {}

  /**
   * Returns ICE server config to pass to WebRTC clients.
   */
  getIceServers(): RTCIceServer[] {
    const stunUrls = this.config.get<string[]>('webrtc.stunUrls', [
      'stun:stun.l.google.com:19302',
    ]);

    const iceServers: RTCIceServer[] = [{ urls: stunUrls }];

    const turnUrl = this.config.get<string | null>('webrtc.turnUrl', null);
    const turnUsername = this.config.get<string | null>('webrtc.turnUsername', null);
    const turnCredential = this.config.get<string | null>('webrtc.turnCredential', null);

    if (turnUrl && turnUsername && turnCredential) {
      iceServers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential,
      });
    }

    return iceServers;
  }

  async startSession(channelId: string, speakerId: string): Promise<VoiceSessionDocument> {
    return this.voiceSessionModel.create({
      channelId: new Types.ObjectId(channelId),
      speakerId: new Types.ObjectId(speakerId),
      startedAt: new Date(),
    });
  }

  async endSession(channelId: string, speakerId: string): Promise<void> {
    const session = await this.voiceSessionModel
      .findOne({
        channelId: new Types.ObjectId(channelId),
        speakerId: new Types.ObjectId(speakerId),
        endedAt: null,
      })
      .sort({ startedAt: -1 })
      .exec();

    if (session) {
      const endedAt = new Date();
      const durationMs = endedAt.getTime() - session.startedAt.getTime();
      await this.voiceSessionModel
        .findByIdAndUpdate(session._id, { endedAt, durationMs })
        .exec();
    }
  }

  async getActiveSessionsForChannel(channelId: string): Promise<VoiceSessionDocument[]> {
    return this.voiceSessionModel
      .find({ channelId: new Types.ObjectId(channelId), endedAt: null })
      .populate('speakerId', 'username avatar')
      .exec();
  }
}
