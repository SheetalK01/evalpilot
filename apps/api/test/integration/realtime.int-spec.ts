import {
  type JoinAck,
  REALTIME_COMMANDS,
  REALTIME_EVENTS,
  REALTIME_NAMESPACE,
  type ResultCreatedPayload,
  type RunCompletedPayload,
  type RunProgressPayload,
} from '@evalpilot/shared';
import { RealtimePublisher } from '@evalpilot/server-core';
import { io, type Socket } from 'socket.io-client';
import { signUp } from '../utils/api-client';
import {
  createCase,
  createProject,
  createShopbotTarget,
  createSuite,
  seedFinishedRun,
} from '../utils/fixtures';
import { createTestApp, type TestApp } from '../utils/test-app';

describe('Realtime gateway (Socket.IO)', () => {
  let t: TestApp;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    t = await createTestApp({ listen: true });
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
  });

  afterAll(async () => {
    await t.close();
  });

  function connect(headers: Record<string, string>): Socket {
    const socket = io(`${t.url}${REALTIME_NAMESPACE}`, {
      transports: ['websocket'],
      extraHeaders: headers,
      reconnection: false,
      forceNew: true,
    });
    sockets.push(socket);
    return socket;
  }

  const connected = (socket: Socket) =>
    new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', (error) => reject(error));
    });

  const rejected = (socket: Socket) =>
    new Promise<Error>((resolve, reject) => {
      socket.once('connect', () => reject(new Error('should not connect')));
      socket.once('connect_error', (error) => resolve(error));
    });

  const join = (socket: Socket, room: unknown) =>
    socket.timeout(2000).emitWithAck(REALTIME_COMMANDS.join, room) as Promise<JoinAck>;

  async function runOf(owner: Awaited<ReturnType<typeof signUp>>) {
    const project = await createProject(owner.client);
    const target = await createShopbotTarget(owner.client, project.id);
    const suite = await createSuite(owner.client, project.id, { targetId: target.id });
    const testCase = await createCase(owner.client, suite.id);
    return { project, run: await seedFinishedRun(t.prisma, suite.id, ['PASSED'], [testCase.id]) };
  }

  it('delivers run events to the owner in the order they were published', async () => {
    const owner = await signUp(t);
    const { run } = await runOf(owner);
    const socket = connect({ cookie: owner.cookie, origin: t.config.webUrl });
    await connected(socket);
    expect(await join(socket, { room: `run:${run.id}` })).toEqual({ ok: true });

    const received: string[] = [];
    const finished = new Promise<void>((resolve) => {
      socket.on(REALTIME_EVENTS.runProgress, (payload: RunProgressPayload) =>
        received.push(`progress:${payload.done}`),
      );
      socket.on(REALTIME_EVENTS.resultCreated, () => received.push('result'));
      socket.on(REALTIME_EVENTS.runCompleted, () => {
        received.push('completed');
        resolve();
      });
    });

    const publisher = t.app.get(RealtimePublisher);
    for (let done = 1; done <= 5; done++) {
      await publisher.publish('run', run.id, REALTIME_EVENTS.resultCreated, {
        result: { id: `r${done}` },
      } as unknown as ResultCreatedPayload);
      await publisher.publish('run', run.id, REALTIME_EVENTS.runProgress, { runId: run.id, done, total: 5 });
    }
    await publisher.publish('run', run.id, REALTIME_EVENTS.runCompleted, {
      run: { id: run.id },
    } as unknown as RunCompletedPayload);
    await finished;

    expect(received).toEqual([
      'result',
      'progress:1',
      'result',
      'progress:2',
      'result',
      'progress:3',
      'result',
      'progress:4',
      'result',
      'progress:5',
      'completed',
    ]);
  });

  it("cannot join another user's run room and never receives its events", async () => {
    const owner = await signUp(t);
    const intruder = await signUp(t);
    const { run } = await runOf(owner);
    const socket = connect({ cookie: intruder.cookie, origin: t.config.webUrl });
    await connected(socket);

    expect(await join(socket, { room: `run:${run.id}` })).toEqual({ ok: false, error: 'Not found' });

    const leaked: unknown[] = [];
    socket.on(REALTIME_EVENTS.resultCreated, (payload) => leaked.push(payload));
    await t.app.get(RealtimePublisher).publish('run', run.id, REALTIME_EVENTS.resultCreated, {
      result: { secret: true },
    } as unknown as ResultCreatedPayload);
    // Round-trip a join on the same socket: by the time it answers, any event would have arrived.
    await join(socket, { room: `run:${run.id}` });
    expect(leaked).toEqual([]);
  });

  it('lets owners join project and red-team rooms, and rejects malformed rooms', async () => {
    const owner = await signUp(t);
    const { project } = await runOf(owner);
    const redteam = await t.prisma.redteamRun.create({ data: { projectId: project.id } });
    const socket = connect({ cookie: owner.cookie, origin: t.config.webUrl });
    await connected(socket);
    expect(await join(socket, { room: `project:${project.id}` })).toEqual({ ok: true });
    expect(await join(socket, { room: `redteam:${redteam.id}` })).toEqual({ ok: true });
    expect(await join(socket, { room: 'admin:everything' })).toEqual({ ok: false, error: 'Not found' });
    expect(await join(socket, 'run:abc')).toEqual({ ok: false, error: 'Send { room: "run:<id>" }' });
    expect(
      await socket.timeout(2000).emitWithAck(REALTIME_COMMANDS.leave, { room: `project:${project.id}` }),
    ).toEqual({ ok: true });
  });

  it.each([
    ['no session cookie', (): Record<string, string> => ({})],
    ['a tampered session cookie', (cookie: string) => ({ cookie: `${cookie}x` })],
  ])('rejects a connection with %s', async (_label, headers) => {
    const owner = await signUp(t);
    const socket = connect({ origin: t.config.webUrl, ...headers(owner.cookie) });
    const error = await rejected(socket);
    expect(error.message).toBe('Unauthorized');
  });

  it('rejects a handshake from a foreign origin (cross-site WebSocket hijacking)', async () => {
    const owner = await signUp(t);
    const socket = connect({ cookie: owner.cookie, origin: 'https://evil.example' });
    await expect(rejected(socket)).resolves.toBeInstanceOf(Error);
  });
});
