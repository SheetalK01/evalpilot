import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';

export const metadata: Metadata = {
  title: { default: 'Flight deck', template: '%s · EvalPilot' },
  robots: { index: false },
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
