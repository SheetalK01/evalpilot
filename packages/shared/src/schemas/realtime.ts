/** Socket.IO namespace and event names shared by the API gateway and the web client. */
export const REALTIME_NAMESPACE = '/realtime';

export const REALTIME_EVENTS = {
  runProgress: 'run.progress',
  resultCreated: 'result.created',
  runCompleted: 'run.completed',
  redteamFinding: 'redteam.finding',
  redteamCompleted: 'redteam.completed',
  traceCreated: 'trace.created',
} as const;
export type RealtimeEvent = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

/** Client → server messages. */
export const REALTIME_COMMANDS = {
  join: 'room.join',
  leave: 'room.leave',
} as const;

export type RoomKind = 'run' | 'redteam' | 'project';

export function roomName(kind: RoomKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseRoomName(room: string): { kind: RoomKind; id: string } | null {
  const match = /^(run|redteam|project):([\w-]{1,40})$/.exec(room);
  if (!match?.[1] || !match[2]) return null;
  return { kind: match[1] as RoomKind, id: match[2] };
}

/** Redis pub/sub channel the worker publishes on and the API subscribes to. */
export const REALTIME_REDIS_CHANNEL = 'evalpilot:realtime';

export interface RealtimeEnvelope<T = unknown> {
  room: string;
  event: RealtimeEvent;
  payload: T;
}

export interface RunProgressPayload {
  runId: string;
  done: number;
  total: number;
}
