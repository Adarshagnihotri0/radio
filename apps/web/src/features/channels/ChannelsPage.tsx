import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { channelsApi, Channel } from '@/services/channels.api';
import { useChannelStore } from '@/stores/channel.store';
import { getSocket } from '@/sockets/socket.client';
import { Radio, Lock, Users, Plus, X, LogIn, MapPin, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

type RadiusOption = { label: string; km: number };
const RADIUS_OPTIONS: RadiusOption[] = [
    { label: '1 km', km: 1 },
    { label: '5 km', km: 5 },
    { label: '25 km', km: 25 },
    { label: '100 km', km: 100 },
];

type LocState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; lat: number; lng: number }
    | { status: 'error'; message: string };

function makeChannelName(lat: number, lng: number): string {
    const ns = lat >= 0 ? 'N' : 'S';
    const ew = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lng).toFixed(2)}°${ew}`;
}

function makeFrequency(): string {
    const base = Math.floor(Math.random() * 800 + 100);
    const dec = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${base}.${dec}`;
}

export function ChannelsPage() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ['channels'],
        queryFn: () => channelsApi.list(),
    });

    const { activeChannelId, setActiveChannel, setChannels } = useChannelStore();

    const [showCreate, setShowCreate] = useState(false);
    const [loc, setLoc] = useState<LocState>({ status: 'idle' });
    const [radiusKm, setRadiusKm] = useState(25);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (data?.data) setChannels(data.data);
    }, [data, setChannels]);

    // Auto-fetch location when panel opens
    useEffect(() => {
        if (!showCreate) { setLoc({ status: 'idle' }); return; }
        setLoc({ status: 'loading' });
        navigator.geolocation.getCurrentPosition(
            (pos) => setLoc({ status: 'ready', lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => setLoc({ status: 'error', message: 'Location denied — allow access and try again' }),
            { enableHighAccuracy: true, timeout: 8000 },
        );
    }, [showCreate]);

    const joinChannel = (channel: Channel) => {
        const socket = getSocket();
        if (activeChannelId && activeChannelId !== channel._id) {
            socket.emit('channel:leave', { channelId: activeChannelId });
        }
        socket.emit('channel:join', { channelId: channel._id });
        setActiveChannel(channel._id);
        toast.success(`Joined ${channel.name}`, { icon: '📡' });
    };

    const leaveChannel = (channel: Channel) => {
        const socket = getSocket();
        socket.emit('channel:leave', { channelId: channel._id });
        setActiveChannel(null);
        toast('Left channel', { icon: '📴' });
    };

    const handleCreate = useCallback(async () => {
        if (loc.status !== 'ready') return;
        setCreating(true);
        try {
            const name = makeChannelName(loc.lat, loc.lng);
            await channelsApi.create({
                name,
                frequency: makeFrequency(),
                latitude: loc.lat,
                longitude: loc.lng,
                radiusKm,
            });
            toast.success(`Channel created`);
            setShowCreate(false);
            await queryClient.invalidateQueries({ queryKey: ['channels'] });
        } catch {
            toast.error('Failed to create channel');
        } finally {
            setCreating(false);
        }
    }, [loc, radiusKm, queryClient]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                Scanning frequencies...
            </div>
        );
    }

    return (
        <div className="p-6 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Radio className="text-radar-500" size={20} />
                <h1 className="text-lg font-bold text-gray-100 tracking-wide">Channels</h1>
                <span className="text-xs text-gray-500 ml-auto">{data?.total ?? 0} total</span>
                <button
                    onClick={() => setShowCreate((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-radar-700 hover:bg-radar-600 text-white text-xs transition-colors"
                >
                    {showCreate ? <X size={13} /> : <Plus size={13} />}
                    {showCreate ? 'Cancel' : 'Create'}
                </button>
            </div>

            {/* Create panel */}
            {showCreate && (
                <div className="hud-card mb-5 space-y-4">
                    <p className="text-xs text-radar-400 uppercase tracking-widest font-semibold">New Channel</p>

                    {/* Location status */}
                    <div className="flex items-center gap-2 text-sm">
                        {loc.status === 'loading' && (
                            <><Loader2 size={14} className="text-radar-400 animate-spin" /><span className="text-gray-400">Detecting location…</span></>
                        )}
                        {loc.status === 'ready' && (
                            <><MapPin size={14} className="text-radar-400" />
                            <span className="text-gray-300 font-mono text-xs">{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</span>
                            <span className="text-gray-600 text-xs ml-1">· name auto-generated</span></>
                        )}
                        {loc.status === 'error' && (
                            <><MapPin size={14} className="text-red-400" /><span className="text-red-400 text-xs">{loc.message}</span></>
                        )}
                    </div>

                    {/* Radius picker */}
                    <div>
                        <p className="text-xs text-gray-400 mb-2">Coverage radius</p>
                        <div className="flex gap-2">
                            {RADIUS_OPTIONS.map((o) => (
                                <button key={o.km} type="button"
                                    onClick={() => setRadiusKm(o.km)}
                                    className={clsx(
                                        'px-3 py-1.5 rounded text-xs transition-colors',
                                        radiusKm === o.km
                                            ? 'bg-radar-700 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700',
                                    )}>
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => void handleCreate()}
                        disabled={loc.status !== 'ready' || creating}
                        className="w-full py-2 bg-radar-700 hover:bg-radar-600 disabled:opacity-40 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        {creating && <Loader2 size={13} className="animate-spin" />}
                        {creating ? 'Creating…' : 'Launch Channel Here'}
                    </button>
                </div>
            )}

            {/* Channel list */}
            <div className="space-y-2">
                {data?.data.map((channel) => {
                    const isActive = activeChannelId === channel._id;
                    return (
                        <div
                            key={channel._id}
                            className={clsx(
                                'hud-card transition-colors',
                                isActive && 'border-radar-500 bg-radar-950/20',
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={clsx('w-2 h-2 rounded-full shrink-0',
                                            isActive ? 'bg-radar-500 animate-pulse' : 'bg-gray-600')} />
                                        <span className="font-medium text-sm text-gray-100 truncate">{channel.name}</span>
                                        {channel.encrypted && <Lock size={11} className="text-amber-400 shrink-0" />}
                                    </div>
                                    <p className="freq-display text-xs mt-1 ml-4">{channel.frequency} MHz</p>
                                    {channel.description && (
                                        <p className="text-xs text-gray-500 mt-0.5 ml-4 truncate">{channel.description}</p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 ml-3 shrink-0">
                                    <div className="flex items-center gap-1 text-gray-500 text-xs">
                                        <Users size={12} />
                                        <span>{channel.activeUsers}/{channel.maxUsers}</span>
                                    </div>

                                    {isActive ? (
                                        <button
                                            onClick={() => leaveChannel(channel)}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-gray-700 hover:bg-red-900/60 text-gray-300 hover:text-red-300 transition-colors"
                                        >
                                            Leave
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => joinChannel(channel)}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-radar-800 hover:bg-radar-700 text-radar-300 transition-colors"
                                        >
                                            <LogIn size={11} />
                                            Join
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="mt-2 ml-4">
                                <div className="w-full bg-gray-800 rounded-full h-0.5">
                                    <div
                                        className="bg-radar-600 h-0.5 rounded-full"
                                        style={{ width: `${Math.min((channel.activeUsers / channel.maxUsers) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}

                {(!data?.data || data.data.length === 0) && (
                    <div className="text-center text-gray-600 text-sm py-12">
                        No channels found. Hit <span className="text-radar-500">Create</span> to add one.
                    </div>
                )}
            </div>
        </div>
    );
}
