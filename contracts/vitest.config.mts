import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['consumer/**/*.pact.test.ts', 'provider/**/*.pact.test.ts'],
    // Pact mock servers and the provider app use real ports; keep files sequential.
    fileParallelism: false,
    // The SDK's 401 interaction has failed once on a CI runner while passing locally every time;
    // one retry in CI keeps the job honest without hiding a consistent break.
    retry: process.env.CI ? 1 : 0,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
