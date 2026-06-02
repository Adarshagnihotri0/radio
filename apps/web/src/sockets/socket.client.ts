import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';
import toast from 'react-hot-toast';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().accessToken;

    socket = io('/signaling', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.warn('[Socket] Connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    // Surface server-side WsException errors to the user
    socket.on('exception', (err: { message?: string } | string) => {
      const msg = typeof err === 'string' ? err : (err?.message ?? 'Unknown server error');
      toast.error(msg);
    });
  }

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
