import Link from 'next/link';
import type { ReactNode } from 'react';
import { InstrumentArt } from '@/components/instruments/states';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/shell/theme-toggle';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="EvalPilot home">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>
        <p className="num text-[11px] text-muted">© 2026 SHEETAL KHADANGA</p>
      </div>
      <aside
        className="relative hidden overflow-hidden border-l border-line bg-panel lg:flex lg:flex-col lg:justify-between lg:p-12"
        aria-hidden
      >
        <div className="label-mono">PRE-FLIGHT CHECK</div>
        <div className="flex flex-col items-center gap-10">
          <InstrumentArt className="size-64 text-line-strong" />
          <div className="grid w-full max-w-md grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line">
            {[
              ['SUITES', 'Rules + AI judge'],
              ['RED-TEAM', '26 attacks'],
              ['CI GATE', 'Exit code 1'],
            ].map(([label, value]) => (
              <div key={label} className="space-y-2 bg-panel p-4">
                <div className="label-mono">{label}</div>
                <div className="num text-[13px] text-text">{value}</div>
              </div>
            ))}
          </div>
        </div>
        <blockquote className="max-w-md text-muted">
          <p className="font-display text-xl text-text">
            “TestPilot uses AI for testing. EvalPilot tests AI.”
          </p>
        </blockquote>
      </aside>
    </div>
  );
}
