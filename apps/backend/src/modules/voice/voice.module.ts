import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { VoiceSession, VoiceSessionSchema } from '../../database/schemas/voice-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: VoiceSession.name, schema: VoiceSessionSchema }]),
  ],
  controllers: [VoiceController],
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
