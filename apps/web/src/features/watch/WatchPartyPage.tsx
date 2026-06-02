import { useEffect, useMemo, useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useChannelStore } from '@/stores/channel.store';
import { useAuthStore } from '@/stores/auth.store';
import { getSocket } from '@/sockets/socket.client';

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

function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

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

  const playerRef = useRef<ReactPlayer | null>(null);
  const loadedVideoIdRef = useRef<string | null>(null);
  const latestPositionRef = useRef(0);

  const [videoInput, setVideoInput] = useState('');
  const [hostUserId, setHostUserId] = useState<string | null>(null);
  const [mediaState, setMediaState] = useState<MediaState | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const isHost = Boolean(userId && hostUserId === userId);

  const getCurrentTime = () => playerRef.current?.getCurrentTime() ?? 0;

  const getCurrentPlaybackRate = () => {
    const internal = playerRef.current?.getInternalPlayer() as
      | { getPlaybackRate?: () => number }
      | undefined;
    const rate = internal?.getPlaybackRate?.();
    return typeof rate === 'number' && Number.isFinite(rate) ? rate : playbackRate;
  };

  useEffect(() => {
    if (!activeChannelId) {
      setHostUserId(null);
      setMediaState(null);
      return;
    }

    const socket = getSocket();

    setSocketConnected(socket.connected);
    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    const applyMediaEvent = (event: MediaSyncEvent) => {
      if (event.channelId !== activeChannelId) return;
      setHostUserId(event.hostUserId);
      setMediaState(event.mediaState);
    };

    const handleMediaSet = (event: MediaSyncEvent) => {
      if (event.channelId !== activeChannelId) return;
      applyMediaEvent(event);
      if (event.mediaState.updatedByUserId === userId) {
        toast.success('Video loaded for the room');
      }
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
    socket.on('room:media:set', handleMediaSet);
    socket.on('room:media:host_left', handleHostLeft);
    socket.on('room:media:host_taken', handleHostTaken);
    socket.on('room:media:not_host', handleNotHost);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:media:sync', applyMediaEvent);
      socket.off('room:media:set', handleMediaSet);
      socket.off('room:media:host_left', handleHostLeft);
      socket.off('room:media:host_taken', handleHostTaken);
      socket.off('room:media:not_host', handleNotHost);
    };
  }, [activeChannelId, userId]);

  useEffect(() => {
    if (!mediaState || !activeChannelId) return;

    const expectedPosition = mediaState.isPlaying
      ? mediaState.positionSec + (Date.now() - mediaState.updatedAtMs) / 1000
      : mediaState.positionSec;

    if (loadedVideoIdRef.current !== mediaState.videoId) {
      loadedVideoIdRef.current = mediaState.videoId;
      setCurrentVideoId(mediaState.videoId);
      setPlayerReady(false);
    }

    setPlaybackRate(mediaState.playbackRate);
    setIsPlaying(mediaState.isPlaying);

    if (!isHost && playerReady) {
      const drift = expectedPosition - latestPositionRef.current;
      if (Math.abs(drift) > 0.5) {
        playerRef.current?.seekTo(Math.max(0, expectedPosition), 'seconds');
      }
    }
  }, [activeChannelId, mediaState, isHost, playerReady]);

  useEffect(() => {
    if (!activeChannelId || !isHost || !mediaState) return;

    const socket = getSocket();
    const id = setInterval(() => {
      socket.emit('room:media:state', {
        channelId: activeChannelId,
        positionSec: getCurrentTime(),
        playbackRate: getCurrentPlaybackRate(),
        isPlaying,
      });
    }, 2000);

    return () => clearInterval(id);
  }, [activeChannelId, isHost, mediaState, isPlaying, playbackRate]);

  const loadVideoAsHost = () => {
    if (!activeChannelId) return;

    if (!socketConnected) {
      toast.error('Not connected to server - check backend');
      return;
    }

    const videoId = extractVideoId(videoInput);
    if (!videoId) {
      toast.error('Enter a valid YouTube URL or video ID');
      return;
    }

    getSocket().emit('room:media:set', {
      channelId: activeChannelId,
      provider: 'youtube',
      videoId,
      positionSec: 0,
      isPlaying: false,
      playbackRate: 1,
    });
  };

  const emitControl = (event: 'room:media:play' | 'room:media:pause' | 'room:media:seek') => {
    if (!activeChannelId || !isHost) return;

    getSocket().emit(event, {
      channelId: activeChannelId,
      positionSec: getCurrentTime(),
      playbackRate: getCurrentPlaybackRate(),
    });
  };

  const playAsHost = () => {
    if (!isHost) return;
    setIsPlaying(true);
    emitControl('room:media:play');
  };

  const pauseAsHost = () => {
    if (!isHost) return;
    setIsPlaying(false);
    emitControl('room:media:pause');
  };

  const seekBySeconds = (delta: number) => {
    if (!isHost) return;

    const next = Math.max(0, getCurrentTime() + delta);
    playerRef.current?.seekTo(next, 'seconds');
    emitControl('room:media:seek');
  };

  if (!activeChannelId || !activeChannel) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
        <p className="text-xl">Join a channel first, then open Watch Party.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <div className="hud-card">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Watch Party</p>
        <h1 className="text-xl text-radar-300 font-semibold mt-1">{activeChannel.name}</h1>
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm text-gray-400">
            {isHost ? 'You are the host.' : hostUserId ? `Host: ${hostUserId}` : 'No host active.'}
          </p>
          <span className={clsx('flex items-center gap-1.5 text-xs', socketConnected ? 'text-green-400' : 'text-red-400')}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', socketConnected ? 'bg-green-400' : 'bg-red-500 animate-pulse')} />
            {socketConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="hud-card space-y-3">
        <label className="block text-xs text-gray-400 uppercase tracking-wide">YouTube URL or ID</label>
        <div className="flex flex-col md:flex-row gap-2">
          <input
            value={videoInput}
            onChange={(e) => setVideoInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                loadVideoAsHost();
              }
            }}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 outline-none focus:border-radar-500"
          />
          <button
            onClick={loadVideoAsHost}
            className="px-4 py-2 rounded-md bg-radar-700 text-white text-sm hover:bg-radar-600 transition-colors"
          >
            Load as Host
          </button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-gray-800 bg-black aspect-video">
        {currentVideoId ? (
          <ReactPlayer
            ref={playerRef}
            url={`https://www.youtube.com/watch?v=${currentVideoId}`}
            width="100%"
            height="100%"
            controls
            playing={isPlaying}
            playbackRate={playbackRate}
            onReady={() => setPlayerReady(true)}
            onProgress={({ playedSeconds }) => {
              latestPositionRef.current = playedSeconds;
            }}
            onPlay={() => {
              if (isHost) emitControl('room:media:play');
            }}
            onPause={() => {
              if (isHost) emitControl('room:media:pause');
            }}
            onError={(error) => {
              const message = typeof error === 'string' ? error : 'Playback failed. This video may block embeds.';
              toast.error(message);
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
            Load a YouTube video to start the watch party.
          </div>
        )}
      </div>

      <div className="hud-card flex flex-wrap items-center gap-2">
        <button
          onClick={() => seekBySeconds(-10)}
          disabled={!isHost || !playerReady}
          className="px-3 py-2 text-sm rounded-md border border-gray-700 text-gray-200 disabled:opacity-40"
        >
          -10s
        </button>
        <button
          onClick={playAsHost}
          disabled={!isHost || !playerReady}
          className="px-3 py-2 text-sm rounded-md border border-gray-700 text-gray-200 disabled:opacity-40"
        >
          Play
        </button>
        <button
          onClick={pauseAsHost}
          disabled={!isHost || !playerReady}
          className="px-3 py-2 text-sm rounded-md border border-gray-700 text-gray-200 disabled:opacity-40"
        >
          Pause
        </button>
        <button
          onClick={() => seekBySeconds(10)}
          disabled={!isHost || !playerReady}
          className="px-3 py-2 text-sm rounded-md border border-gray-700 text-gray-200 disabled:opacity-40"
        >
          +10s
        </button>
        {!isHost && <span className="text-xs text-gray-600 ml-auto">Controls available to host only</span>}
      </div>
    </div>
  );
}
