import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import YouTubePlayer from 'youtube-player';
import { useChannelStore } from '@/stores/channel.store';
import { useAuthStore } from '@/stores/auth.store';
import { getSocket } from '@/sockets/socket.client';

type YouTubePlayerInstance = ReturnType<typeof YouTubePlayer>;

type MediaProvider = 'youtube';

interface MediaState {
  provider: MediaProvider;
  videoId: string;
  isPlaying: boolean;
  positionSec: number;
  playbackRate: number;
  updatedAtMs: number;
  updatedByUserId: string;
}

interface MediaSyncEvent {
  channelId: string;
  hostUserId: string | null;
  mediaState: MediaState;
}

function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();

  // Direct 11-char YouTube ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);

    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.replace('/', '').trim();
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (url.hostname.includes('youtube.com')) {
      const vParam = url.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
        return vParam;
      }

      const segments = url.pathname.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1] ?? '';
      return /^[a-zA-Z0-9_-]{11}$/.test(lastSegment) ? lastSegment : null;
    }
  } catch {
    return null;
  }

  return null;
}

export function WatchPartyPage() {
  const activeChannelId = useChannelStore((s) => s.activeChannelId);
  const channels = useChannelStore((s) => s.channels);
  const userId = useAuthStore((s) => s.userId);

  const activeChannel = useMemo(
    () => channels.find((channel) => channel._id === activeChannelId),
    [channels, activeChannelId],
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const loadedVideoIdRef = useRef<string | null>(null);

  const [videoInput, setVideoInput] = useState('');
  const [hostUserId, setHostUserId] = useState<string | null>(null);
  const [mediaState, setMediaState] = useState<MediaState | null>(null);

  const isHost = Boolean(userId && hostUserId === userId);

  useEffect(() => {
    if (!containerRef.current || playerRef.current) {
      return;
    }

    const player = YouTubePlayer(containerRef.current, {
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 0,
        controls: 1,
        rel: 0,
        modestbranding: 1,
      },
    });

    playerRef.current = player;

    return () => {
      void player.destroy();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!activeChannelId) {
      setHostUserId(null);
      setMediaState(null);
      return;
    }

    const socket = getSocket();

    const applyMediaEvent = (event: MediaSyncEvent) => {
      if (event.channelId !== activeChannelId) return;
      setHostUserId(event.hostUserId);
      setMediaState(event.mediaState);
    };

    const handleHostLeft = ({ channelId }: { channelId: string }) => {
      if (channelId !== activeChannelId) return;
      setHostUserId(null);
      toast('Host left the watch party');
    };

    const handleHostTaken = ({ channelId }: { channelId: string }) => {
      if (channelId !== activeChannelId) return;
      toast.error('Another host already controls this room');
    };

    const handleNotHost = ({ channelId }: { channelId: string }) => {
      if (channelId !== activeChannelId) return;
      toast.error('Only the host can control playback');
    };

    socket.on('room:media:sync', applyMediaEvent);
    socket.on('room:media:set', applyMediaEvent);
    socket.on('room:media:host_left', handleHostLeft);
    socket.on('room:media:host_taken', handleHostTaken);
    socket.on('room:media:not_host', handleNotHost);

    return () => {
      socket.off('room:media:sync', applyMediaEvent);
      socket.off('room:media:set', applyMediaEvent);
      socket.off('room:media:host_left', handleHostLeft);
      socket.off('room:media:host_taken', handleHostTaken);
      socket.off('room:media:not_host', handleNotHost);
    };
  }, [activeChannelId]);

  useEffect(() => {
    const player = playerRef.current;

    if (!player || !mediaState || !activeChannelId) {
      return;
    }

    if (isHost && mediaState.updatedByUserId === userId) {
      return;
    }

    const applyState = async () => {
      try {
        const expectedPosition = mediaState.isPlaying
          ? mediaState.positionSec + (Date.now() - mediaState.updatedAtMs) / 1000
          : mediaState.positionSec;

        if (loadedVideoIdRef.current !== mediaState.videoId) {
          await player.loadVideoById(mediaState.videoId, Math.max(0, expectedPosition));
          loadedVideoIdRef.current = mediaState.videoId;
        } else {
          const currentTime = await player.getCurrentTime();
          const drift = expectedPosition - currentTime;

          if (Math.abs(drift) > 0.25) {
            await player.seekTo(Math.max(0, expectedPosition), true);
          }
        }

        await player.setPlaybackRate(mediaState.playbackRate);

        if (mediaState.isPlaying) {
          await player.playVideo();
        } else {
          await player.pauseVideo();
        }
      } catch {
        // Ignore transient player errors while iframe is initializing.
      }
    };

    void applyState();
  }, [activeChannelId, mediaState, isHost, userId]);

  useEffect(() => {
    if (!activeChannelId || !isHost || !mediaState) {
      return;
    }

    const socket = getSocket();
    const id = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      void (async () => {
        try {
          const positionSec = await player.getCurrentTime();
          const playbackRate = await player.getPlaybackRate();
          const stateCode = await player.getPlayerState();

          socket.emit('room:media:state', {
            channelId: activeChannelId,
            positionSec,
            playbackRate,
            isPlaying: stateCode === 1,
          });
        } catch {
          // Ignore temporary player API failures.
        }
      })();
    }, 2000);

    return () => clearInterval(id);
  }, [activeChannelId, isHost, mediaState]);

  const loadVideoAsHost = () => {
    if (!activeChannelId) return;

    const videoId = extractYouTubeVideoId(videoInput);
    if (!videoId) {
      toast.error('Enter a valid YouTube URL or video ID');
      return;
    }

    const socket = getSocket();
    socket.emit('room:media:set', {
      channelId: activeChannelId,
      provider: 'youtube',
      videoId,
      positionSec: 0,
      isPlaying: false,
      playbackRate: 1,
    });

    toast.success('Video loaded for the room');
  };

  const emitPlaybackAction = async (event: 'room:media:play' | 'room:media:pause' | 'room:media:seek') => {
    if (!activeChannelId || !isHost || !playerRef.current) return;

    try {
      const player = playerRef.current;
      const positionSec = await player.getCurrentTime();
      const playbackRate = await player.getPlaybackRate();

      const socket = getSocket();
      socket.emit(event, {
        channelId: activeChannelId,
        positionSec,
        playbackRate,
      });
    } catch {
      toast.error('Player is not ready yet');
    }
  };

  const playAsHost = async () => {
    if (!playerRef.current || !isHost) return;
    await playerRef.current.playVideo();
    await emitPlaybackAction('room:media:play');
  };

  const pauseAsHost = async () => {
    if (!playerRef.current || !isHost) return;
    await playerRef.current.pauseVideo();
    await emitPlaybackAction('room:media:pause');
  };

  const seekBySeconds = async (delta: number) => {
    if (!playerRef.current || !isHost) return;

    try {
      const current = await playerRef.current.getCurrentTime();
      const next = Math.max(0, current + delta);
      await playerRef.current.seekTo(next, true);
      await emitPlaybackAction('room:media:seek');
    } catch {
      toast.error('Cannot seek right now');
    }
  };

  if (!activeChannelId || !activeChannel) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
        <p className="text-2xl">Video room unavailable</p>
        <p className="text-sm">Join a channel first, then open Watch Party.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="hud-card">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Watch Party</p>
        <h1 className="text-xl text-radar-300 font-semibold mt-1">{activeChannel.name}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {isHost ? 'You are the host.' : hostUserId ? `Host user: ${hostUserId}` : 'No host active.'}
        </p>
      </div>

      <div className="hud-card space-y-3">
        <label className="block text-xs text-gray-400 uppercase tracking-wide">YouTube URL or ID</label>
        <div className="flex flex-col md:flex-row gap-2">
          <input
            value={videoInput}
            onChange={(e) => setVideoInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 outline-none focus:border-radar-500"
          />
          <button
            onClick={loadVideoAsHost}
            className="px-4 py-2 rounded-md bg-radar-700 text-white text-sm hover:bg-radar-600 transition-colors"
          >
            Load As Host
          </button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-gray-800 bg-black aspect-video">
        <div ref={containerRef} className="w-full h-full" />
      </div>

      <div className="hud-card flex flex-wrap items-center gap-2">
        <button
          onClick={() => void seekBySeconds(-10)}
          disabled={!isHost}
          className="px-3 py-2 text-sm rounded-md border border-gray-700 text-gray-200 disabled:opacity-50"
        >
          -10s
        </button>
        <button
          onClick={() => void playAsHost()}
          disabled={!isHost}
          className="px-3 py-2 text-sm rounded-md border border-gray-700 text-gray-200 disabled:opacity-50"
        >
          Play
        </button>
        <button
          onClick={() => void pauseAsHost()}
          disabled={!isHost}
          className="px-3 py-2 text-sm rounded-md border border-gray-700 text-gray-200 disabled:opacity-50"
        >
          Pause
        </button>
        <button
          onClick={() => void seekBySeconds(10)}
          disabled={!isHost}
          className="px-3 py-2 text-sm rounded-md border border-gray-700 text-gray-200 disabled:opacity-50"
        >
          +10s
        </button>
      </div>
    </div>
  );
}
