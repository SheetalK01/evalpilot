'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { useMe } from '@/lib/queries';
import { Scan } from '../instruments/states';
import { CommandPalette } from './command-palette';
import { DeckProvider } from './deck-context';
import { NewProjectDialog } from './new-project-dialog';
import { ShortcutsDialog, useGlobalShortcuts } from './shortcuts';
import { SideNav } from './side-nav';
import { StatusBar } from './status-bar';

function Shell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  useGlobalShortcuts();
  return (
    <div className="min-h-dvh">
      <StatusBar onOpenNav={() => setNavOpen(true)} />
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-12 hidden h-[calc(100dvh-3rem)] w-60 shrink-0 border-r border-line md:block">
          <SideNav />
        </aside>
        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
      <DialogPrimitive.Root open={navOpen} onOpenChange={setNavOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_oklab,var(--bg)_70%,transparent)] md:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-72 border-r border-line bg-panel md:hidden">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Pages and projects</DialogPrimitive.Description>
            <SideNav onNavigate={() => setNavOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <CommandPalette />
      <ShortcutsDialog />
      <NewProjectDialog />
    </div>
  );
}

function BootScreen() {
  return (
    <div className="min-h-dvh" role="status" aria-label="Loading your flight deck">
      <div className="flex h-12 items-center gap-4 border-b border-line px-4">
        <Scan className="h-5 w-28" />
        <Scan className="h-3 w-48" />
      </div>
      <div className="mx-auto max-w-5xl space-y-6 p-8">
        <Scan className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Scan key={i} className="h-24" />
          ))}
        </div>
        <Scan className="h-64" />
      </div>
    </div>
  );
}

/** Every /app page: requires a session (redirects to /login) and renders the cockpit shell. */
export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const unauthorized = me.error instanceof ApiError && me.error.status === 401;

  useEffect(() => {
    if (unauthorized) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [unauthorized, router, pathname]);

  if (me.isLoading || unauthorized) return <BootScreen />;
  return (
    <DeckProvider>
      <Shell>{children}</Shell>
    </DeckProvider>
  );
}
