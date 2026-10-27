import type { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import type { PrismaService } from '@evalpilot/server-core';
import type { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

const user = (overrides: Partial<User> = {}): User => ({
  id: 'u1',
  name: 'Ada',
  email: 'ada@example.com',
  passwordHash: null,
  githubId: null,
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

function setup() {
  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  };
  const users = { findByEmail: jest.fn() };
  const jwt = { sign: jest.fn(() => 'signed-token') };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    users as unknown as UsersService,
    jwt as unknown as JwtService,
  );
  return { service, prisma, users, jwt };
}

const profile = {
  githubId: 'gh-42',
  email: 'Ada@Example.com',
  name: 'Ada L',
  avatarUrl: 'https://avatars.example/ada.png',
};

describe('AuthService.findOrCreateGithubUser', () => {
  it('returns the user already linked to the GitHub id', async () => {
    const { service, prisma } = setup();
    const linked = user({ githubId: 'gh-42' });
    prisma.user.findUnique.mockResolvedValue(linked);
    await expect(service.findOrCreateGithubUser(profile)).resolves.toBe(linked);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('links GitHub to an existing account with the same email, keeping its avatar', async () => {
    const { service, prisma, users } = setup();
    prisma.user.findUnique.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(user({ avatarUrl: 'https://existing/avatar.png' }));
    prisma.user.update.mockImplementation(({ data }: { data: Partial<User> }) => Promise.resolve(user(data)));

    const result = await service.findOrCreateGithubUser(profile);
    expect(users.findByEmail).toHaveBeenCalledWith('ada@example.com');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { githubId: 'gh-42', avatarUrl: 'https://existing/avatar.png' },
    });
    expect(result.githubId).toBe('gh-42');
  });

  it('creates an account, using a noreply address when GitHub hides the email', async () => {
    const { service, prisma, users } = setup();
    prisma.user.findUnique.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }: { data: Partial<User> }) => Promise.resolve(user(data)));

    const result = await service.findOrCreateGithubUser({ ...profile, email: null });
    expect(result.email).toBe('gh-42@users.noreply.github.com');
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        githubId: 'gh-42',
        email: 'gh-42@users.noreply.github.com',
        name: 'Ada L',
        avatarUrl: 'https://avatars.example/ada.png',
      },
    });
  });
});

describe('AuthService.validateCredentials', () => {
  it('rejects OAuth-only accounts that have no password', async () => {
    const { service, users } = setup();
    users.findByEmail.mockResolvedValue(user({ passwordHash: null }));
    await expect(service.validateCredentials('ada@example.com', 'anything1')).resolves.toBeNull();
  });
});

describe('AuthService.issueToken', () => {
  it('signs the user id as the subject', () => {
    const { service, jwt } = setup();
    expect(service.issueToken('u1')).toBe('signed-token');
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 'u1' });
  });
});
