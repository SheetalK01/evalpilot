'use client';

import { Command, LogOut, Menu, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { disconnectSocket } from '@/lib/realtime';
import { useHealth, useLogout, useMe, useProject } from '@/lib/queries';
import { Led } from '../instruments/status';
import { Logo } from '../logo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/menu';
import { Kbd } from '../ui/misc';
import { useDeck } from './deck-context';
import { ThemeToggle } from './theme-toggle';

function UtcClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="num text-[11px] text-muted" aria-label="UTC time">
      UTC {now ? now.toISOString().slice(11, 19) : '--:--:--'}
    </span>
  );
}

function HealthLeds() {
  const health = useHealth();
  const checks = health.data?.checks;
  const known = !health.isLoading;
  const tone = (up: boolean | undefined) => (!known ? 'muted' : up ? 'pass' : 'fail');
  const leds: [string, boolean | undefined][] = [
    ['API', health.data !== null && health.data !== undefined],
    ['DB', checks?.db === 'up'],
    ['REDIS', checks?.redis === 'up'],
    ['WORKER', checks?.worker === 'up'],
  ];
  return (
    <div
      className="flex items-center gap-3.5"
      role="status"
      aria-label={leds.map(([name, up]) => `${name} ${up ? 'up' : 'down'}`).join(', ')}
      data-testid="health-leds"
    >
      {leds.map(([name, up]) => (
        <Led key={name} tone={tone(up)} label={name} />
      ))}
    </div>
  );
}

function CurrentProject() {
  const { projectId } = useDeck();
  const project = useProject(projectId ?? '');
  if (!projectId || !project.data) return null;
  return (
    <Link href={`/app/projects/${projectId}`} className="hidden min-w-0 items-center gap-2 lg:flex">
      <span className="label-mono">PROJECT</span>
      <span className="truncate text-[13px] text-text hover:text-signal">{project.data.name}</span>
    </Link>
  );
}

/** Cockpit strip on every app page: health LEDs, UTC clock, current project, ⌘K. */
export function StatusBar({ onOpenNav }: { onOpenNav: () => void }) {
  const { setPaletteOpen } = useDeck();
  const me = useMe();
  const logout = useLogout();
  const router = useRouter();
  const initials = (me.data?.name ?? '?')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg">
      <div className="flex h-12 items-center gap-3 px-3 sm:px-4">
        <button
          type="button"
          onClick={onOpenNav}
          className="inline-flex size-8 items-center justify-center rounded-sm text-muted hover:bg-panel-2 hover:text-text md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-4" strokeWidth={1.5} />
        </button>
        <Link href="/app" aria-label="EvalPilot dashboard" className="shrink-0">
          <Logo compact className="sm:hidden" />
          <Logo className="hidden sm:inline-flex" />
        </Link>
        <span className="hidden h-5 w-px bg-line sm:block" />
        <HealthLeds />
        <span className="hidden h-5 w-px bg-line md:block" />
        <div className="hidden md:block">
          <UtcClock />
        </div>
        <span className="hidden h-5 w-px bg-line lg:block" />
        <CurrentProject />
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden h-8 items-center gap-2 rounded-sm border border-line px-2.5 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-text sm:inline-flex"
            data-testid="command-palette-open"
          >
            <Command className="size-3.5" strokeWidth={1.5} /> Search
            <Kbd>⌘K</Kbd>
          </button>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger
              className="ml-1 inline-flex size-8 items-center justify-center rounded-sm border border-line bg-panel-2 font-mono text-[11px] text-text hover:border-line-strong"
              aria-label={`${initials} · account menu`}
              data-testid="user-menu"
            >
              {initials}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>
                <div className="text-text">{me.data?.name}</div>
                <div className="num truncate text-[12px]">{me.data?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push('/app/settings')}>
                <Settings /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="logout"
                onSelect={() =>
                  logout.mutate(undefined, {
                    onSuccess: () => {
                      disconnectSocket();
                      router.push('/login');
                    },
                  })
                }
              >
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
