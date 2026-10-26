import type { ProjectResponse } from '@evalpilot/shared';
import { signUp } from '../utils/api-client';
import { createProject, createSuite } from '../utils/fixtures';
import { createTestApp, type TestApp } from '../utils/test-app';

describe('Projects API', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates, reads, updates and deletes a project', async () => {
    const { client } = await signUp(t);

    const created = await client
      .post('/projects', { name: '  ShopSphere  ', description: 'Support bot' })
      .expect(201);
    expect(created.body).toEqual({
      id: expect.any(String),
      name: 'ShopSphere',
      description: 'Support bot',
      suiteCount: 0,
      targetCount: 0,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    const id = (created.body as ProjectResponse).id;

    await client.get(`/projects/${id}`).expect(200);
    const updated = await client.patch(`/projects/${id}`, { name: 'ShopSphere EU' }).expect(200);
    expect(updated.body).toMatchObject({ name: 'ShopSphere EU', description: 'Support bot' });

    await client.delete(`/projects/${id}`).expect(204);
    await client.get(`/projects/${id}`).expect(404);
  });

  it('validates input', async () => {
    const { client } = await signUp(t);
    const res = await client.post('/projects', { name: '' }).expect(400);
    expect(res.body.errors).toEqual([{ path: 'name', message: 'Enter a project name' }]);
  });

  it('lists only my projects, newest first, with cursor pagination', async () => {
    const { client } = await signUp(t);
    const other = await signUp(t);
    await createProject(other.client, 'Not mine');
    const names = ['First', 'Second', 'Third'];
    for (const name of names) await createProject(client, name);

    const page1 = await client.get('/projects?limit=2').expect(200);
    expect(page1.body.items.map((p: ProjectResponse) => p.name)).toEqual(['Third', 'Second']);
    expect(page1.body.nextCursor).toEqual(expect.any(String));

    const page2 = await client.get(`/projects?limit=2&cursor=${page1.body.nextCursor as string}`).expect(200);
    expect(page2.body.items.map((p: ProjectResponse) => p.name)).toEqual(['First']);
    expect(page2.body.nextCursor).toBeNull();
  });

  it('rejects a page size above 100', async () => {
    const { client } = await signUp(t);
    await client.get('/projects?limit=101').expect(400);
  });

  it('counts suites and targets', async () => {
    const { client } = await signUp(t);
    const project = await createProject(client);
    await createSuite(client, project.id);
    const res = await client.get(`/projects/${project.id}`).expect(200);
    expect(res.body).toMatchObject({ suiteCount: 1, targetCount: 0 });
  });

  it('deleting a project cascades to its children', async () => {
    const { client } = await signUp(t);
    const project = await createProject(client);
    const suite = await createSuite(client, project.id);
    await client.delete(`/projects/${project.id}`).expect(204);
    expect(await t.prisma.testSuite.findUnique({ where: { id: suite.id } })).toBeNull();
  });

  describe('ownership (IDOR)', () => {
    it("returns 404 for every action on another user's project", async () => {
      const owner = await signUp(t);
      const intruder = await signUp(t);
      const project = await createProject(owner.client);

      await intruder.client.get(`/projects/${project.id}`).expect(404);
      await intruder.client.patch(`/projects/${project.id}`, { name: 'Hacked' }).expect(404);
      await intruder.client.delete(`/projects/${project.id}`).expect(404);

      const unchanged = await owner.client.get(`/projects/${project.id}`).expect(200);
      expect(unchanged.body.name).toBe(project.name);
    });
  });
});
