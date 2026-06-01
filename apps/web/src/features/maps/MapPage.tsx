import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useQuery } from '@tanstack/react-query';
import { channelsApi } from '@/services/channels.api';
import { useChannelStore } from '@/stores/channel.store';

function LocationMarker() {
    const [position, setPosition] = useState<[number, number] | null>(null);

    useMapEvents({
        locationfound(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
        locationerror() {
            console.warn('[Map] Location access denied');
        },
    });

    useEffect(() => {
        // Trigger location detection on mount
        // Note: useMapEvents hook handles this internally
    }, []);

    if (!position) return null;

    return (
        <Marker position={position}>
            <Popup>You are here</Popup>
        </Marker>
    );
}

export function MapPage() {
    const { data } = useQuery({
        queryKey: ['channels'],
        queryFn: () => channelsApi.list(),
    });

    const { activeChannelId, setActiveChannel } = useChannelStore();

    return (
        <div className="h-full relative">
            <MapContainer
                center={[40.7128, -74.006]}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
                className="z-0"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                <LocationMarker />

                {data?.data.map((channel) => {
                    const [lng, lat] = channel.center.coordinates;
                    const isActive = activeChannelId === channel._id;

                    return (
                        <Circle
                            key={channel._id}
                            center={[lat, lng]}
                            radius={channel.radiusKm * 1000}
                            pathOptions={{
                                color: isActive ? '#22c55e' : '#166534',
                                fillColor: isActive ? '#22c55e' : '#052e16',
                                fillOpacity: isActive ? 0.15 : 0.08,
                                weight: isActive ? 2 : 1,
                            }}
                            eventHandlers={{
                                click: () => setActiveChannel(channel._id),
                            }}
                        >
                            <Popup className="font-mono">
                                <div className="text-sm">
                                    <strong>{channel.name}</strong>
                                    <p className="text-xs text-gray-500">{channel.frequency} MHz</p>
                                    <p className="text-xs">{channel.activeUsers} online · {channel.radiusKm} km radius</p>
                                </div>
                            </Popup>
                        </Circle>
                    );
                })}
            </MapContainer>

            {/* Overlay legend */}
            <div className="absolute bottom-4 left-4 hud-card z-[1000] text-xs space-y-1">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-radar-500 bg-radar-500/20" />
                    <span className="text-gray-400">Active channel</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border border-radar-800 bg-radar-950/20" />
                    <span className="text-gray-500">Inactive channel</span>
                </div>
            </div>
        </div>
    );
}
