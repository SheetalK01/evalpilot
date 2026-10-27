'use client';

import {
  type JoinAck,
  REALTIME_COMMANDS,
  REALTIME_NAMESPACE,
  type RealtimePayloads,
} from '@evalpilot/shared';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

let socket: Socket | null = null;

/** One shared Socket.IO connection, authenticated by the session cookie. */
export function getSocket(): Socket {
  socket ??= io(`${API_URL}${REALTIME_NAMESPACE}`, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 5000,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

type Handlers = { [E in keyof RealtimePayloads]?: (payload: RealtimePayloads[E]) => void };
export type RealtimeStatus = 'connecting' | 'live' | 'offline';

/**
 * Joins a room (`run:<id>`, `redteam:<id>`, `project:<id>`) while the component is mounted and
 * calls the matching handler for each event. Re-joins after a reconnect.
 */
export function useRealtimeRoom(room: string | null, handlers: Handlers): RealtimeStatus {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    if (!room) return undefined;
    const client = getSocket();
    const join = () => {
      client.emit(REALTIME_COMMANDS.join, { room }, (ack: JoinAck) => setStatus(ack.ok ? 'live' : 'offline'));
    };
    const onDisconnect = () => setStatus('offline');
    const listeners = (Object.keys(handlersRef.current) as (keyof RealtimePayloads)[]).map((event) => {
      const listener = (payload: unknown) => {
        (handlersRef.current[event] as ((p: unknown) => void) | undefined)?.(payload);
      };
      client.on(event, listener);
      return [event, listener] as const;
    });

    client.on('connect', join);
    client.on('disconnect', onDisconnect);
    client.on('connect_error', onDisconnect);
    if (client.connected) join();

    return () => {
      client.emit(REALTIME_COMMANDS.leave, { room });
      client.off('connect', join);
      client.off('disconnect', onDisconnect);
      client.off('connect_error', onDisconnect);
      for (const [event, listener] of listeners) client.off(event, listener);
    };
  }, [room]);

  return status;
}
