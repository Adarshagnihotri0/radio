import { useEffect, useMemo, useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Search } from 'lucide-react';
import { useChannelStore } from '@/stores/channel.store';
import { useAuthStore } from '@/stores/auth.store';
import { getSocket } from '@/sockets/socket.client';
import { youtubeApi, YouTubeSearchItem } from '@/services/youtube.api';

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
    const value = input.trim();
    if (!value) return null;

    // Raw video IDs are 11 chars.
    if (/^[a-zA-Z0-9_-]{11}$/.test(value)) {
        return value;
    }

    try {
        const url = new URL(value);
        const host = url.hostname.replace(/^www\./, '').toLowerCase();

        if (host === 'youtu.be') {
            const candidate = url.pathname.split('/').filter(Boolean)[0];
            return candidate && /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null;
        }

        if (host.endsWith('youtube.com')) {
            const v = url.searchParams.get('v');
            if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
                return v;
            }

            const parts = url.pathname.split('/').filter(Boolean);
            const embedIndex = parts.findIndex((p) => p === 'embed' || p === 'shorts' || p === 'live');
            if (embedIndex >= 0 && parts[embedIndex + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[embedIndex + 1])) {
                return parts[embedIndex + 1];
            }
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
    const needsInitialSyncRef = useRef(true);
    const suppressNextPlayEventRef = useRef(false);
    const suppressNextPauseEventRef = useRef(false);
    const suppressNextSeekEventRef = useRef(false);
    const lastSeekEmitAtRef = useRef(0);
    const lastProgressPositionRef = useRef<number | null>(null);
    const followerPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestMediaUpdatedAtRef = useRef<number>(0);
    const lastProgressWallClockRef = useRef<number>(0);
    const hostBackgroundPlaybackRef = useRef(false);
    const hostBackgroundPositionRef = useRef(0);
    const hostBackgroundStartedAtRef = useRef(0);

    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<YouTubeSearchItem[]>([]);
    const [hostUserId, setHostUserId] = useState<string | null>(null);
    const [mediaState, setMediaState] = useState<MediaState | null>(null);
    const [socketConnected, setSocketConnected] = useState(false);
    const [playerReady, setPlayerReady] = useState(false);
    const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [followerAudioEnabled, setFollowerAudioEnabled] = useState(false);

    const isHost = Boolean(userId && hostUserId === userId);
    const canControl = Boolean(userId) && (!hostUserId || isHost);
    const shouldMutePlayer = !canControl && !followerAudioEnabled;
    const hasRapidApiKey = youtubeApi.hasKey();

    useEffect(() => {
        // Non-host viewers often require an explicit gesture before audio can play.
        if (canControl) {
            setFollowerAudioEnabled(true);
            return;
        }
        setFollowerAudioEnabled(false);
    }, [canControl, activeChannelId, currentVideoId]);

    const getCurrentTime = () => playerRef.current?.getCurrentTime() ?? 0;

    const getCurrentPlaybackRate = () => {
        const internal = playerRef.current?.getInternalPlayer() as
            | { getPlaybackRate?: () => number }
            | undefined;
        const rate = internal?.getPlaybackRate?.();
        return typeof rate === 'number' && Number.isFinite(rate) ? rate : playbackRate;
    };

    const getHostBroadcastPosition = () => {
        if (!hostBackgroundPlaybackRef.current) {
            return getCurrentTime();
        }

        const elapsedSec = Math.max(0, (Date.now() - hostBackgroundStartedAtRef.current) / 1000);
        return hostBackgroundPositionRef.current + elapsedSec * playbackRate;
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

        latestMediaUpdatedAtRef.current = mediaState.updatedAtMs;

        if (loadedVideoIdRef.current !== mediaState.videoId) {
            loadedVideoIdRef.current = mediaState.videoId;
            setCurrentVideoId(mediaState.videoId);
            latestPositionRef.current = 0;
            lastProgressPositionRef.current = null;
            lastProgressWallClockRef.current = 0;
            needsInitialSyncRef.current = true;
            setPlayerReady(false);
        }

        setPlaybackRate(mediaState.playbackRate);

        if (canControl) {
            setIsPlaying(mediaState.isPlaying);
        } else if (mediaState.isPlaying) {
            if (followerPauseTimerRef.current) {
                clearTimeout(followerPauseTimerRef.current);
                followerPauseTimerRef.current = null;
            }
            setIsPlaying(true);
        } else {
            if (followerPauseTimerRef.current) {
                clearTimeout(followerPauseTimerRef.current);
            }

            const pauseAtVersion = mediaState.updatedAtMs;
            followerPauseTimerRef.current = setTimeout(() => {
                // Apply pause only if no newer sync update arrived and playback really stalled.
                const stalledForMs = Date.now() - lastProgressWallClockRef.current;
                if (latestMediaUpdatedAtRef.current === pauseAtVersion && stalledForMs > 2200) {
                    setIsPlaying(false);
                }
            }, 2600);
        }

        if (!isHost && playerReady) {
            const drift = expectedPosition - latestPositionRef.current;
            if (needsInitialSyncRef.current || Math.abs(drift) > 3) {
                playerRef.current?.seekTo(Math.max(0, expectedPosition), 'seconds');
                needsInitialSyncRef.current = false;
            }
        }
    }, [activeChannelId, mediaState, isHost, playerReady, canControl]);

    useEffect(() => {
        return () => {
            if (followerPauseTimerRef.current) {
                clearTimeout(followerPauseTimerRef.current);
                followerPauseTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const onVisibilityChange = () => {
            if (!canControl) return;

            if (document.hidden) {
                if (isPlaying) {
                    hostBackgroundPlaybackRef.current = true;
                    hostBackgroundPositionRef.current = getCurrentTime();
                    hostBackgroundStartedAtRef.current = Date.now();
                }
                return;
            }

            if (!hostBackgroundPlaybackRef.current) {
                return;
            }

            const expected = getHostBroadcastPosition();
            suppressNextSeekEventRef.current = true;
            latestPositionRef.current = expected;
            playerRef.current?.seekTo(Math.max(0, expected), 'seconds');
            emitControl('room:media:seek', expected);
            emitControl('room:media:play', expected);
            hostBackgroundPlaybackRef.current = false;
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [canControl, isPlaying, playbackRate]);

    useEffect(() => {
        if (!activeChannelId || !isHost || !mediaState) return;

        const socket = getSocket();
        const id = setInterval(() => {
            socket.emit('room:media:state', {
                channelId: activeChannelId,
                positionSec: getHostBroadcastPosition(),
                playbackRate: getCurrentPlaybackRate(),
                isPlaying: hostBackgroundPlaybackRef.current ? true : isPlaying,
            });
        }, 1000);

        return () => clearInterval(id);
    }, [activeChannelId, isHost, mediaState, isPlaying, playbackRate]);

    useEffect(() => {
        if (!mediaState || !playerReady || canControl) return;

        const id = setInterval(() => {
            const expectedPosition = mediaState.isPlaying
                ? mediaState.positionSec + (Date.now() - mediaState.updatedAtMs) / 1000
                : mediaState.positionSec;

            const drift = expectedPosition - latestPositionRef.current;
            if (!mediaState.isPlaying && Math.abs(drift) > 0.6) {
                playerRef.current?.seekTo(Math.max(0, expectedPosition), 'seconds');
                latestPositionRef.current = Math.max(0, expectedPosition);
                setPlaybackRate(mediaState.playbackRate);
                return;
            }

            if (Math.abs(drift) > 4) {
                playerRef.current?.seekTo(Math.max(0, expectedPosition), 'seconds');
                latestPositionRef.current = Math.max(0, expectedPosition);
                setPlaybackRate(mediaState.playbackRate);
                return;
            }

            if (Math.abs(drift) > 1.2) {
                const correctedRate = drift > 0
                    ? Math.min(mediaState.playbackRate + 0.04, 1.05)
                    : Math.max(mediaState.playbackRate - 0.04, 0.95);
                setPlaybackRate(correctedRate);
                return;
            }

            if (Math.abs(drift) < 0.25 && playbackRate !== mediaState.playbackRate) {
                setPlaybackRate(mediaState.playbackRate);
            }
        }, 1500);

        return () => clearInterval(id);
    }, [mediaState, playerReady, canControl, playbackRate]);

    const loadVideoAsHost = (videoId: string) => {
        if (!activeChannelId) return;

        if (!socketConnected) {
            toast.error('Not connected to server - check backend');
            return;
        }

        if (!canControl) {
            toast.error('Another host controls this room');
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

    const searchYouTube = async () => {
        const query = searchQuery.trim();
        if (!query) {
            toast.error('Enter a search query');
            return;
        }

        const directVideoId = extractYouTubeVideoId(query);
        if (directVideoId) {
            loadVideoAsHost(directVideoId);
            setSearchResults([]);
            return;
        }

        if (!hasRapidApiKey) {
            toast.error('Missing VITE_RAPIDAPI_KEY. Add it in apps/web/.env and restart web:dev');
            return;
        }

        setSearching(true);
        try {
            const items = await youtubeApi.search(query);
            setSearchResults(items);
            if (items.length === 0) {
                toast('No videos found for this query');
            }
        } catch {
            toast.error('YouTube search failed');
        } finally {
            setSearching(false);
        }
    };

    const emitControl = (
        event: 'room:media:play' | 'room:media:pause' | 'room:media:seek',
        positionSec?: number,
    ) => {
        if (!activeChannelId || !canControl) return;

        getSocket().emit(event, {
            channelId: activeChannelId,
            positionSec: positionSec ?? getCurrentTime(),
            playbackRate: getCurrentPlaybackRate(),
        });
    };

    const playAsHost = () => {
        if (!canControl) return;
        suppressNextPlayEventRef.current = true;
        setIsPlaying(true);
        emitControl('room:media:play');
    };

    const pauseAsHost = () => {
        if (!canControl) return;
        suppressNextPauseEventRef.current = true;
        setIsPlaying(false);
        emitControl('room:media:pause');
    };

    const seekBySeconds = (delta: number) => {
        if (!canControl) return;

        const next = Math.max(0, getCurrentTime() + delta);
        suppressNextSeekEventRef.current = true;
        latestPositionRef.current = next;
        playerRef.current?.seekTo(next, 'seconds');
        emitControl('room:media:seek', next);
    };

    if (!activeChannelId || !activeChannel) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
                <p className="text-xl">Join a channel first, then open Watch Party.</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-4 max-w-6xl mx-auto">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <div className="hud-card space-y-3">
                    <label className="block text-xs text-gray-400 uppercase tracking-wide">YouTube Search</label>
                    {!hasRapidApiKey && (
                        <div className="text-xs text-amber-400 bg-amber-950/40 border border-amber-800 rounded-md px-3 py-2">
                            Missing <span className="font-semibold">VITE_RAPIDAPI_KEY</span> in <span className="font-semibold">apps/web/.env</span>.
                            Add it and restart <span className="font-semibold">npm run web:dev</span>.
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void searchYouTube();
                                }
                            }}
                            placeholder="Search videos or paste channel ID (UC...)"
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 outline-none focus:border-radar-500"
                        />
                        <button
                            onClick={() => void searchYouTube()}
                            className="px-4 py-2 rounded-md bg-radar-700 text-white text-sm hover:bg-radar-600 transition-colors shrink-0"
                        >
                            <span className="inline-flex items-center gap-1.5">
                                <Search size={14} />
                                {searching ? 'Searching...' : 'Search'}
                            </span>
                        </button>
                    </div>

                    <div className="max-h-[28rem] overflow-auto space-y-2 pr-1">
                        {searchResults.length === 0 && (
                            <div className="text-xs text-gray-500 py-6 text-center">
                                Search results will appear here.
                            </div>
                        )}
                        {searchResults.map((video) => {
                            const videoId = video.id.videoId;
                            if (!videoId) return null;
                            const thumb = video.snippet.thumbnails?.medium?.url ?? video.snippet.thumbnails?.default?.url;
                            return (
                                <button
                                    key={videoId}
                                    onClick={() => loadVideoAsHost(videoId)}
                                    disabled={!canControl}
                                    className={clsx(
                                        'w-full text-left p-2 rounded-md border border-gray-800 hover:border-radar-700 transition-colors flex gap-3',
                                        !canControl && 'opacity-50 cursor-not-allowed',
                                    )}
                                >
                                    <img
                                        src={thumb}
                                        alt={video.snippet.title}
                                        className="w-28 h-16 object-cover rounded bg-gray-900 shrink-0"
                                    />
                                    <span className="min-w-0">
                                        <p className="text-sm text-gray-100 line-clamp-2">{video.snippet.title}</p>
                                        <p className="text-xs text-gray-500 mt-1 truncate">{video.snippet.channelTitle}</p>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="relative rounded-xl overflow-hidden border border-gray-800 bg-black aspect-video">
                        {currentVideoId ? (
                            <>
                            <ReactPlayer
                                ref={playerRef}
                                url={`https://www.youtube.com/watch?v=${currentVideoId}`}
                                width="100%"
                                height="100%"
                                controls={canControl}
                                playing={isPlaying}
                                playbackRate={playbackRate}
                                muted={shouldMutePlayer}
                                onReady={() => {
                                    setPlayerReady(true);

                                    if (!isHost && mediaState) {
                                        const expectedPosition = mediaState.isPlaying
                                            ? mediaState.positionSec +
                                              (Date.now() - mediaState.updatedAtMs) / 1000
                                            : mediaState.positionSec;

                                        playerRef.current?.seekTo(Math.max(0, expectedPosition), 'seconds');
                                        needsInitialSyncRef.current = false;
                                    }
                                }}
                                onProgress={({ playedSeconds }) => {
                                    const previous = lastProgressPositionRef.current;
                                    latestPositionRef.current = playedSeconds;
                                    lastProgressPositionRef.current = playedSeconds;
                                    lastProgressWallClockRef.current = Date.now();

                                    // Fallback for YouTube iframe: some seekbar drags don't fire onSeek.
                                    if (canControl && previous !== null) {
                                        const jumpDelta = Math.abs(playedSeconds - previous);
                                        if (jumpDelta > 2.5) {
                                            const now = Date.now();
                                            if (now - lastSeekEmitAtRef.current >= 250) {
                                                lastSeekEmitAtRef.current = now;
                                                emitControl('room:media:seek', playedSeconds);
                                            }
                                        }
                                    }
                                }}
                                onSeek={(seconds) => {
                                    latestPositionRef.current = seconds;
                                    if (canControl) {
                                        if (suppressNextSeekEventRef.current) {
                                            suppressNextSeekEventRef.current = false;
                                            return;
                                        }

                                        const now = Date.now();
                                        if (now - lastSeekEmitAtRef.current < 250) {
                                            return;
                                        }
                                        lastSeekEmitAtRef.current = now;
                                        emitControl('room:media:seek', seconds);
                                    }
                                }}
                                onPlay={() => {
                                    if (canControl) {
                                        if (suppressNextPlayEventRef.current) {
                                            suppressNextPlayEventRef.current = false;
                                            return;
                                        }
                                        setIsPlaying(true);
                                        emitControl('room:media:play');
                                    }
                                }}
                                onPause={() => {
                                    if (canControl) {
                                        if (document.hidden || hostBackgroundPlaybackRef.current) {
                                            return;
                                        }
                                        if (suppressNextPauseEventRef.current) {
                                            suppressNextPauseEventRef.current = false;
                                            return;
                                        }
                                        setIsPlaying(false);
                                        emitControl('room:media:pause');
                                    }
                                }}
                                onError={(error) => {
                                    const message = typeof error === 'string' ? error : 'Playback failed. This video may block embeds.';
                                    toast.error(message);
                                }}
                            />
                            {!canControl && shouldMutePlayer && (
                                <button
                                    onClick={() => setFollowerAudioEnabled(true)}
                                    className="absolute bottom-3 right-3 z-10 px-3 py-2 text-xs rounded-md bg-radar-700 hover:bg-radar-600 text-white transition-colors"
                                >
                                    Enable audio
                                </button>
                            )}
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                                Select a video from search results.
                            </div>
                        )}
                    </div>

                    <div className="hud-card flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => seekBySeconds(-10)}
                            disabled={!canControl || !playerReady}
                            className="px-3 py-2 text-sm rounded-md border border-gray-700 text-gray-200 disabled:opacity-40"
                        >
                            -10s
                        </button>
                        <button
                            onClick={playAsHost}
                            disabled={!canControl || !playerReady}
                            className="px-3 py-2 text-sm rounded-md border border-gray-700 text-gray-200 disabled:opacity-40"
                        >
                            Play
                        </button>
                        <button
                            onClick={pauseAsHost}
                            disabled={!canControl || !playerReady}
                            className="px-3 py-2 text-sm rounded-md border border-gray-700 text-gray-200 disabled:opacity-40"
                        >
                            Pause
                        </button>
                        <button
                            onClick={() => seekBySeconds(10)}
                            disabled={!canControl || !playerReady}
                            className="px-3 py-2 text-sm rounded-md border border-gray-700 text-gray-200 disabled:opacity-40"
                        >
                            +10s
                        </button>
                        {!canControl && <span className="text-xs text-gray-600 ml-auto">Controls available to host only</span>}
                    </div>
                </div>
            </div>
        </div>
    );
}
