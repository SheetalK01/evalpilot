import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';
import './globals.css';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', display: 'swap' });
const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
  display: 'swap',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'EvalPilot — Test your AI before your users do', template: '%s · EvalPilot' },
  description:
    'Test, red-team and monitor AI apps: test suites with rule and AI-judge checks, live runs, a red-team attack library, production traces and a CI gate.',
  applicationName: 'EvalPilot',
  authors: [{ name: 'Sheetal Khadanga', url: 'https://sheetalk01.github.io' }],
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0b0d0c' },
    { media: '(prefers-color-scheme: light)', color: '#f3f1ea' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <head>
        {/* Sets the theme before first paint (no flash of the wrong theme). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only z-50 rounded-sm bg-signal px-3 py-2 text-signal-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
