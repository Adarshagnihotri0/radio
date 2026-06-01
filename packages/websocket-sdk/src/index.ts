/**
 * @radius/websocket-sdk
 * Typed Socket.IO client factory for Radius Platform.
 * Re-exports typed event interfaces for use in web and mobile.
 */

import { io, Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@radius/shared-types';

export type TypedSocket = Socket<ServerEvents, ClientEvents>;

export interface RadiusSocketOptions {
  serverUrl: string;
  token: string;
  namespace?: string;
}

/**
 * Create a typed Socket.IO connection to the Radius signaling server.
 */
export function createRadiusSocket(options: RadiusSocketOptions): TypedSocket {
  const { serverUrl, token, namespace = '/signaling' } = options;

  const socket: TypedSocket = io(`${serverUrl}${namespace}`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    timeout: 10_000,
  });

  return socket;
}

// Re-export event type interfaces for consumer convenience
export type { ClientEvents, ServerEvents } from '@radius/shared-types';
