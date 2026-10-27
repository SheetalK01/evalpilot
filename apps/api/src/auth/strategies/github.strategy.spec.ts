import type { Profile } from 'passport-github2';
import type { AuthService } from '../auth.service';
import { GithubStrategy } from './github.strategy';

describe('GithubStrategy', () => {
  const findOrCreateGithubUser = jest.fn();
  const strategy = new GithubStrategy(
    { clientId: 'id', clientSecret: 'secret', callbackUrl: 'http://localhost:4000/api/auth/github/callback' },
    { findOrCreateGithubUser } as unknown as AuthService,
  );

  beforeEach(() =>
    findOrCreateGithubUser.mockReset().mockResolvedValue({ id: 'u1', email: 'ada@example.com', name: 'Ada' }),
  );

  it('maps the GitHub profile and returns the session user', async () => {
    const profile = {
      id: '42',
      displayName: 'Ada Lovelace',
      username: 'ada',
      emails: [{ value: 'ada@example.com' }],
      photos: [{ value: 'https://a/p.png' }],
    };
    await expect(strategy.validate('t', 'r', profile as unknown as Profile)).resolves.toEqual({
      id: 'u1',
      email: 'ada@example.com',
      name: 'Ada',
    });
    expect(findOrCreateGithubUser).toHaveBeenCalledWith({
      githubId: '42',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      avatarUrl: 'https://a/p.png',
    });
  });

  it('falls back to the username, then a generic name, and tolerates missing email/photo', async () => {
    await strategy.validate('t', 'r', { id: '7', displayName: '', username: 'octo' } as unknown as Profile);
    expect(findOrCreateGithubUser).toHaveBeenLastCalledWith({
      githubId: '7',
      email: null,
      name: 'octo',
      avatarUrl: null,
    });
    await strategy.validate('t', 'r', { id: '8', displayName: '' } as unknown as Profile);
    expect(findOrCreateGithubUser).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'GitHub user' }));
  });
});
