import { loadConfig } from './env';

const base = {
  DATABASE_URL: 'mysql://user:pw@127.0.0.1:3306/evalpilot',
  JWT_SECRET: 'a'.repeat(64),
  TARGET_SECRET_KEY: Buffer.alloc(32, 7).toString('base64'),
};

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig(base);
    expect(config).toMatchObject({
      env: 'development',
      isProduction: false,
      port: 4000,
      aiMode: 'mock',
      allowPrivateTargets: false,
      redisPrefix: 'evalpilot',
      anthropic: { apiKey: null, model: 'claude-opus-5-5', judgeEffort: 'medium' },
      github: null,
      rateLimits: { default: 300, auth: 10, v1: 1200 },
    });
    expect(config.allowedOrigins).toEqual(['http://localhost:3000', 'http://localhost:4000']);
    expect(config.targetSecretKey).toHaveLength(32);
  });

  it('treats empty GitHub credentials as not configured', () => {
    expect(loadConfig({ ...base, GITHUB_CLIENT_ID: '', GITHUB_CLIENT_SECRET: '' }).github).toBeNull();
    expect(loadConfig({ ...base, GITHUB_CLIENT_ID: 'id' }).github).toBeNull();
  });

  it('enables GitHub when both credentials are set', () => {
    const config = loadConfig({
      ...base,
      GITHUB_CLIENT_ID: 'id',
      GITHUB_CLIENT_SECRET: 'secret',
      API_URL: 'https://api.evalpilot.dev',
    });
    expect(config.github).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
      callbackUrl: 'https://api.evalpilot.dev/api/auth/github/callback',
    });
  });

  it('adds extra CORS origins, normalised and de-duplicated', () => {
    const config = loadConfig({
      ...base,
      CORS_ORIGINS: 'https://app.example.com/path, http://localhost:3000 ,',
    });
    expect(config.allowedOrigins).toEqual([
      'http://localhost:3000',
      'http://localhost:4000',
      'https://app.example.com',
    ]);
  });

  it('parses booleans and production mode', () => {
    const config = loadConfig({ ...base, NODE_ENV: 'production', ALLOW_PRIVATE_TARGETS: 'true' });
    expect(config.isProduction).toBe(true);
    expect(config.allowPrivateTargets).toBe(true);
  });

  it('requires an Anthropic key in live mode', () => {
    expect(() => loadConfig({ ...base, AI_MODE: 'live' })).toThrow('AI_MODE=live needs ANTHROPIC_API_KEY');
    expect(loadConfig({ ...base, AI_MODE: 'live', ANTHROPIC_API_KEY: 'sk-ant-test' }).anthropic.apiKey).toBe(
      'sk-ant-test',
    );
  });

  it('lists every problem in one readable error', () => {
    expect(() => loadConfig({ JWT_SECRET: 'short', TARGET_SECRET_KEY: 'abc' })).toThrow(
      /DATABASE_URL[\s\S]*JWT_SECRET must be at least 32 characters[\s\S]*TARGET_SECRET_KEY must be 32 bytes/,
    );
  });
});
