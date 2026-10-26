import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { type JoinAck, REALTIME_COMMANDS, REALTIME_NAMESPACE } from '@evalpilot/shared';
import type { Namespace, Socket } from 'socket.io';
import { z } from 'zod';
import type { JwtPayload } from '../auth/auth.service';
import { Public } from '../common/decorators/auth.decorators';
import { UsersService } from '../users/users.service';
import { RealtimeAccessService } from './realtime-access.service';
import { sessionTokenFromCookieHeader } from './session-token';

const roomMessage = z.object({ room: z.string().max(60) });

interface SocketData {
  userId: string;
}

/**
 * Socket.IO namespace `/realtime`. Connections are authenticated with the session cookie at
 * the handshake; a client can only join rooms of resources it owns (`run:<id>`, `redteam:<id>`,
 * `project:<id>`). Events are pushed by RealtimeRelay.
 */
@Public()
@WebSocketGateway({ namespace: REALTIME_NAMESPACE })
export class RealtimeGateway implements OnGatewayInit {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Namespace;

  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly access: RealtimeAccessService,
  ) {}

  afterInit(namespace: Namespace): void {
    namespace.use((socket, next) => {
      void this.authenticate(socket).then(
        (userId) => {
          if (!userId) {
            next(new Error('Unauthorized'));
            return;
          }
          (socket.data as SocketData).userId = userId;
          next();
        },
        () => {
          next(new Error('Unauthorized'));
        },
      );
    });
  }

  private async authenticate(socket: Socket): Promise<string | null> {
    const token = sessionTokenFromCookieHeader(socket.handshake.headers.cookie);
    if (!token) return null;
    const payload = await this.jwt.verifyAsync<JwtPayload>(token, { algorithms: ['HS256'] });
    const user = await this.users.findById(payload.sub);
    return user?.id ?? null;
  }

  @SubscribeMessage(REALTIME_COMMANDS.join)
  async join(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<JoinAck> {
    const parsed = roomMessage.safeParse(body);
    if (!parsed.success) return { ok: false, error: 'Send { room: "run:<id>" }' };
    const { userId } = socket.data as SocketData;
    // Same answer for "does not exist" and "not yours", like the REST API's 404.
    if (!(await this.access.canJoin(userId, parsed.data.room))) return { ok: false, error: 'Not found' };
    await socket.join(parsed.data.room);
    this.logger.debug(`user ${userId} joined ${parsed.data.room}`);
    return { ok: true };
  }

  @SubscribeMessage(REALTIME_COMMANDS.leave)
  async leave(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<JoinAck> {
    const parsed = roomMessage.safeParse(body);
    if (!parsed.success) return { ok: false, error: 'Send { room: "run:<id>" }' };
    await socket.leave(parsed.data.room);
    return { ok: true };
  }

  /** Called by the relay for every event coming from the worker (or the API itself). */
  emitToRoom(room: string, event: string, payload: unknown): void {
    this.server.to(room).emit(event, payload);
  }
}
