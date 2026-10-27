import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Small self-contained server for the Docker image.
  output: 'standalone',
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
  poweredByHeader: false,
  // Lint runs once for the whole monorepo (`npm run lint`), not inside `next build`.
  eslint: { ignoreDuringBuilds: true },
  headers: () =>
    Promise.resolve([
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]),
};

export default config;
