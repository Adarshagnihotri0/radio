import { useEffect, useState, useCallback } from 'react';
import { useChannelStore } from '../stores/channel.store';
import { useAuthStore } from '../stores/auth.store';
import { getSocket } from '../sockets/socket.client';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export function usePtt(channelId: string | null) {
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isChannelBusy, setIsChannelBusy] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  const { setCurrentSpeaker } = useChannelStore();
  const userId = useAuthStore((s) => s.userId);

  useEffect(() => {
    if (!channelId) return;
    const socket = getSocket();

    socket.on('user:speaking', ({ userId: uid, channelId: cId }: { userId: string; channelId: string }) => {
      if (cId === channelId) setCurrentSpeaker(uid);
    });

    socket.on('user:silent', ({ channelId: cId }: { channelId: string }) => {
      if (cId === channelId) setCurrentSpeaker(null);
    });

    socket.on('ptt:busy', ({ channelId: cId }: { channelId: string }) => {
      if (cId === channelId) {
        setIsChannelBusy(true);
        setTimeout(() => setIsChannelBusy(false), 2000);
      }
    });

    return () => {
      socket.off('user:speaking');
      socket.off('user:silent');
      socket.off('ptt:busy');
    };
  }, [channelId, setCurrentSpeaker]);

  const startTransmit = useCallback(async () => {
    if (!channelId || isTransmitting) return;

    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(rec);

      const socket = getSocket();
      socket.emit('ptt:start', { channelId });
      setIsTransmitting(true);
    } catch (err) {
      console.error('[PTT] Mic error:', err);
    }
  }, [channelId, isTransmitting]);

  const stopTransmit = useCallback(async () => {
    if (!channelId || !isTransmitting) return;

    try {
      await recording?.stopAndUnloadAsync();
      setRecording(null);
    } catch { /* ignore */ }

    const socket = getSocket();
    socket.emit('ptt:stop', { channelId });
    setIsTransmitting(false);
  }, [channelId, isTransmitting, recording]);

  return { isTransmitting, isChannelBusy, startTransmit, stopTransmit };
}
