import { useState, useEffect, useCallback } from 'react';
import { useChannelStore } from '@/stores/channel.store';
import { useAuthStore } from '@/stores/auth.store';
import { getSocket } from '@/sockets/socket.client';
import { useWebRTC } from '@/rtc/useWebRTC';
import toast from 'react-hot-toast';

export function usePtt(channelId: string | null) {
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isChannelBusy, setIsChannelBusy] = useState(false);
  const [busySpeakerId, setBusySpeakerId] = useState<string | null>(null);

  const { speaking, currentSpeakerId, setCurrentSpeaker } = useChannelStore();
  const username = useAuthStore((s) => s.username);
  const { startAudio, enableMic, disableMic, stopAll } = useWebRTC(channelId);

  useEffect(() => {
    if (!channelId) return;

    const socket = getSocket();

    socket.on('user:speaking', ({ userId, channelId: cId }: { userId: string; channelId: string }) => {
      if (cId === channelId) setCurrentSpeaker(userId);
    });

    socket.on('user:silent', ({ channelId: cId }: { channelId: string }) => {
      if (cId === channelId) setCurrentSpeaker(null);
    });

    socket.on('ptt:busy', ({ channelId: cId, speakerId }: { channelId: string; speakerId: string }) => {
      if (cId === channelId) {
        setIsChannelBusy(true);
        setBusySpeakerId(speakerId);
        toast('Channel busy — someone else is transmitting', { icon: '🔴' });
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
      await startAudio();
      const socket = getSocket();
      socket.emit('ptt:start', { channelId });
      enableMic();
      setIsTransmitting(true);
    } catch (err) {
      toast.error('Microphone access denied');
    }
  }, [channelId, isTransmitting, startAudio, enableMic]);

  const stopTransmit = useCallback(() => {
    if (!channelId || !isTransmitting) return;

    const socket = getSocket();
    socket.emit('ptt:stop', { channelId });
    disableMic();
    setIsTransmitting(false);
  }, [channelId, isTransmitting, disableMic]);

  return {
    isTransmitting,
    isChannelBusy,
    busySpeakerId,
    speaking,
    currentSpeakerId,
    startTransmit,
    stopTransmit,
  };
}
