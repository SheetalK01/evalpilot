import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  // No runtime dependencies: the SDK only uses the platform's fetch and crypto.
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
});
