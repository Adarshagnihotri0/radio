import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  username!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ type: String, default: null })
  avatar: string | null = null;

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
      default: [0, 0],
    },
  })
  location!: { type: 'Point'; coordinates: [number, number] };

  @Prop({ type: Types.ObjectId, ref: 'Channel', default: null })
  activeChannel: Types.ObjectId | null = null;

  @Prop({ default: false })
  online!: boolean;

  @Prop({ type: Date, default: null })
  lastSeen: Date | null = null;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Channel' }],
    default: [],
  })
  joinedChannels!: Types.ObjectId[];

  @Prop({ default: false })
  isAdmin!: boolean;

  @Prop({ type: String, default: null, select: false })
  refreshTokenHash: string | null = null;
}

export const UserSchema = SchemaFactory.createForClass(User);

// 2dsphere index for geospatial queries
UserSchema.index({ location: '2dsphere' });
UserSchema.index({ username: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ online: 1 });
