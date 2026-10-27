import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['consumer/**/*.pact.test.ts', 'provider/**/*.pact.test.ts'],
    // Pact mock servers and the provider app use real ports; keep files sequential.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
