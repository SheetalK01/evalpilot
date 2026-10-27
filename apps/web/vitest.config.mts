import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vite 8 transforms with Oxc; Next's tsconfig says jsx: preserve, so set the runtime here.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      // Pure logic and instruments are unit-tested here; pages and data hooks are covered by the
      // Playwright E2E suite (e2e/), which drives the real app.
      include: [
        'src/lib/**/*.ts',
        'src/components/instruments/**/*.tsx',
        'src/components/suite/check-builder.tsx',
      ],
      exclude: ['src/lib/queries.ts', 'src/lib/realtime.ts'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
      reporter: ['text-summary', 'lcov', 'json-summary'],
    },
  },
});
