import {
  type JoinAck,
  REALTIME_COMMANDS,
  REALTIME_EVENTS,
  REALTIME_NAMESPACE,
  type ResultCreatedPayload,
  type RunProgressPayload,
  SESSION_COOKIE,
  type TestResultResponse,
} from '@evalpilot/shared';
import { expect, test } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { type Session, registerUser, shopbotWorkspace } from '../../support/api';
import { API_URL, WEB_URL } from '../../support/env';

async function cookieOf(session: Session): Promise<string> {
  const { cookies } = await session.api.ctx.storageState();
  const value = cookies.find((c) => c.name === SESSION_COOKIE)?.value ?? '';
  return `${SESSION_COOKIE}=${value}`;
}

function connect(cookie: string, origin = WEB_URL): Promise<Socket> {
  const socket = io(`${API_URL}${REALTIME_NAMESPACE}`, {
    transports: ['websocket'],
    extraHeaders: { cookie, origin },
    reconnection: false,
    forceNew: true,
  });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (error) => {
      socket.close();
      reject(error);
    });
  });
}

const join = (socket: Socket, room: string) =>
  socket.timeout(3000).emitWithAck(REALTIME_COMMANDS.join, { room }) as Promise<JoinAck>;

test.describe('Real-time run events @realtime', () => {
  test('a real worker run streams every result, in order, then completes', async () => {
    const owner = await registerUser('rt-owner');
    const { suite } = await shopbotWorkspace(owner.api, 5);
    const socket = await connect(await cookieOf(owner));

    const progress: number[] = [];
    const results: TestResultResponse[] = [];
    let completedAfter = -1;
    socket.on(REALTIME_EVENTS.runProgress, (p: RunProgressPayload) => progress.push(p.done));
    socket.on(REALTIME_EVENTS.resultCreated, (p: ResultCreatedPayload) => results.push(p.result));
    const completed = new Promise<void>((resolve) =>
      socket.on(REALTIME_EVENTS.runCompleted, () => {
        completedAfter = results.length;
        resolve();
      }),
    );

    const { runId } = await owner.api.startRun(suite.id);
    expect(await join(socket, `run:${runId}`)).toEqual({ ok: true });

    // The run may finish before the join lands; the REST API fills in anything we missed.
    const run = await owner.api.waitForRun(runId);
    const stored = await owner.api.json<TestResultResponse[]>(owner.api.get(`/runs/${runId}/results`));
    expect(stored).toHaveLength(5);
    const seen = new Set([...results.map((r) => r.id)]);
    for (const result of results) expect(stored.map((r) => r.id)).toContain(result.id);

    if (seen.size < 5) {
      // Joined late: we can only check that whatever arrived was in order.
      expect(progress).toEqual([...progress].sort((a, b) => a - b));
    } else {
      await completed;
      // 0 is the "started" tick, then one per finished case.
      expect(progress).toEqual([0, 1, 2, 3, 4, 5]);
      expect(completedAfter).toBe(5);
    }
    expect(run.total).toBe(5);
    socket.close();
    await owner.api.ctx.dispose();
  });

  test("a user cannot join another user's run, red-team or project room", async () => {
    const owner = await registerUser('rt-a');
    const intruder = await registerUser('rt-b');
    const { project, suite, target } = await shopbotWorkspace(owner.api, 1);
    const { runId } = await owner.api.startRun(suite.id);
    const { redteamRunId } = await owner.api.startRedteam(target.id, ['OFF_TOPIC']);

    const socket = await connect(await cookieOf(intruder));
    const leaked: unknown[] = [];
    for (const event of Object.values(REALTIME_EVENTS))
      socket.on(event, (payload: unknown) => leaked.push(payload));

    for (const room of [`run:${runId}`, `redteam:${redteamRunId}`, `project:${project.id}`]) {
      expect(await join(socket, room), room).toEqual({ ok: false, error: 'Not found' });
    }
    await owner.api.waitForRun(runId);
    await owner.api.waitForRedteam(redteamRunId);
    // Round-trip once more: any event published before this ack would already be here.
    await join(socket, `run:${runId}`);
    expect(leaked).toEqual([]);

    socket.close();
    await owner.api.ctx.dispose();
    await intruder.api.ctx.dispose();
  });

  test('connections without a valid session are refused', async () => {
    await expect(connect('')).rejects.toThrow(/unauthorized/i);
    await expect(connect(`${SESSION_COOKIE}=forged.token.value`)).rejects.toThrow(/unauthorized/i);
  });
});
