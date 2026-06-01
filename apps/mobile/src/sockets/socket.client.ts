import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.store';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().accessToken;

    socket = io(`${BACKEND_URL}/signaling`, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.warn('[Socket] Connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
    });
  }

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
