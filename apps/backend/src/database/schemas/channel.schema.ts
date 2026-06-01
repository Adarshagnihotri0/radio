import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChannelDocument = Channel & Document;

@Schema({ timestamps: true, collection: 'channels' })
export class Channel {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  /**
   * Radio-style frequency identifier, e.g. "152.350 MHz"
   */
  @Prop({ required: true, unique: true })
  frequency!: string;

  /**
   * GeoJSON Point — center of the geo-fenced zone
   */
  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  })
  center!: { type: 'Point'; coordinates: [number, number] };

  /**
   * Radius of the geo-fence in kilometers
   */
  @Prop({ required: true, min: 0.1, max: 1000, default: 5 })
  radiusKm!: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ default: 0, min: 0 })
  activeUsers!: number;

  @Prop({ default: false })
  encrypted!: boolean;

  @Prop({ default: false })
  isPrivate!: boolean;

  @Prop({ default: false })
  isTemporary!: boolean;

  @Prop({ type: Date, default: null })
  expiresAt: Date | null = null;

  @Prop({ default: 100, min: 2, max: 1000 })
  maxUsers!: number;

  @Prop({ default: false })
  emergencyMode!: boolean;

  @Prop({ default: true })
  isActive!: boolean;
}

export const ChannelSchema = SchemaFactory.createForClass(Channel);

// 2dsphere index for geo queries
ChannelSchema.index({ center: '2dsphere' });
ChannelSchema.index({ frequency: 1 }, { unique: true });
ChannelSchema.index({ isActive: 1 });
ChannelSchema.index({ createdBy: 1 });
