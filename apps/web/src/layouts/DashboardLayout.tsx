import { useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { Radio, Map, ListFilter, LogOut, PlaySquare } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/services/auth.api';
import { getSocket, disconnectSocket } from '@/sockets/socket.client';
import { useChannelStore } from '@/stores/channel.store';

const NAV = [
    { to: '/channels', icon: ListFilter, label: 'Channels' },
    { to: '/ptt', icon: Radio, label: 'PTT' },
    { to: '/watch', icon: PlaySquare, label: 'Watch' },
    { to: '/map', icon: Map, label: 'Map' },
];

export function DashboardLayout() {
    const { username, clearAuth } = useAuthStore();
    const activeChannelId = useChannelStore((s) => s.activeChannelId);

    // Re-join the channel room whenever the socket reconnects (room membership is in-memory)
    useEffect(() => {
        const socket = getSocket();
        const rejoin = () => {
            if (activeChannelId) {
                socket.emit('channel:join', { channelId: activeChannelId });
            }
        };
        socket.on('connect', rejoin);
        return () => { socket.off('connect', rejoin); };
    }, [activeChannelId]);

    const handleLogout = async () => {
        try { await authApi.logout(); } catch { /* ignore */ }
        disconnectSocket();
        clearAuth();
    };

    return (
        <div className="flex h-screen bg-gray-950 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-16 md:w-56 flex flex-col bg-gray-900 border-r border-radar-900/40 shrink-0">
                {/* Logo */}
                <div className="px-4 py-5 border-b border-radar-900/40">
                    <div className="flex items-center gap-3">
                        <span className="text-radar-500 text-2xl">◉</span>
                        <span className="hidden md:block text-radar-400 font-bold tracking-widest text-sm uppercase">
                            Radius
                        </span>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 py-4 space-y-1 px-2">
                    {NAV.map(({ to, icon: Icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                                    isActive
                                        ? 'bg-radar-900/40 text-radar-400 border border-radar-800/50'
                                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200',
                                )
                            }
                        >
                            <Icon size={18} />
                            <span className="hidden md:block tracking-wide">{label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-3 border-t border-radar-900/40">
                    <div className="flex items-center gap-2 px-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-radar-500 animate-pulse" />
                        <span className="hidden md:block text-xs text-gray-400 truncate">{username}</span>
                    </div>
                    <button
                        onClick={() => void handleLogout()}
                        className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-800 hover:text-red-400 transition-colors"
                    >
                        <LogOut size={16} />
                        <span className="hidden md:block">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    );
}
