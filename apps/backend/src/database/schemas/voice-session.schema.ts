import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VoiceSessionDocument = VoiceSession & Document;

@Schema({ timestamps: true, collection: 'voice_sessions' })
export class VoiceSession {
  @Prop({ type: Types.ObjectId, ref: 'Channel', required: true, index: true })
  channelId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  speakerId!: Types.ObjectId;

  @Prop({ required: true })
  startedAt!: Date;

  @Prop({ type: Date, default: null })
  endedAt: Date | null = null;

  @Prop({ type: Number, default: null })
  durationMs: number | null = null;
}

export const VoiceSessionSchema = SchemaFactory.createForClass(VoiceSession);

VoiceSessionSchema.index({ channelId: 1, startedAt: -1 });
VoiceSessionSchema.index({ speakerId: 1, startedAt: -1 });
VoiceSessionSchema.index({ endedAt: 1 }, { sparse: true });
