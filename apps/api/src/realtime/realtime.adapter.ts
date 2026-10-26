import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { IncomingMessage } from 'node:http';
import type { ServerOptions } from 'socket.io';
import type { AppConfig } from '@evalpilot/server-core';

/**
 * Socket.IO with the same origin allow-list as the REST API. Rejecting foreign origins at the
 * handshake prevents cross-site WebSocket hijacking (browsers send cookies on WS upgrades).
 */
export class RealtimeIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly config: AppConfig,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    const allowed = this.config.allowedOrigins;
    return super.createIOServer(port, {
      ...options,
      cors: { origin: allowed, credentials: true },
      allowRequest: (req: IncomingMessage, callback: (error: string | null, success: boolean) => void) => {
        const origin = req.headers.origin;
        callback(null, typeof origin === 'string' && allowed.includes(origin));
      },
    });
  }
}
