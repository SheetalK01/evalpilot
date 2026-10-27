'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import {
  FolderKanban,
  Gauge,
  KeyRound,
  LogOut,
  Moon,
  Play,
  Plus,
  Radar,
  ScrollText,
  Settings,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { disconnectSocket } from '@/lib/realtime';
import { useLogout, useProjects, useStartRedteam, useStartRun, useSuites, useTargets } from '@/lib/queries';
import { useTheme } from '../providers';
import { Kbd } from '../ui/misc';
import { useDeck } from './deck-context';

function Item({
  onSelect,
  icon,
  children,
  hint,
  value,
}: {
  onSelect: () => void;
  icon: ReactNode;
  children: ReactNode;
  hint?: string;
  value: string;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-xs px-3 py-2.5 text-sm text-text data-[selected=true]:bg-panel-2 [&_svg]:size-4 [&_svg]:stroke-[1.5] [&_svg]:text-muted"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint ? <Kbd>{hint}</Kbd> : null}
    </Command.Item>
  );
}

const group =
  '[&_[cmdk-group-heading]]:label-mono [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5';

/** ⌘K: jump anywhere and run the common actions without the mouse. */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, projectId, setNewProjectOpen, setShortcutsOpen } = useDeck();
  const router = useRouter();
  const theme = useTheme();
  const projects = useProjects();
  const current = projectId ?? projects.data?.[0]?.id ?? '';
  const suites = useSuites(current);
  const targets = useTargets(current);
  const startRun = useStartRun();
  const startRedteam = useStartRedteam(current);
  const logout = useLogout();

  const run = (action: () => void) => () => {
    setPaletteOpen(false);
    action();
  };
  const go = (href: string) => run(() => router.push(href));

  return (
    <DialogPrimitive.Root open={paletteOpen} onOpenChange={setPaletteOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_oklab,var(--bg)_70%,transparent)]" />
        <DialogPrimitive.Content
          className="panel crosshair fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden"
          data-testid="command-palette"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search pages and actions
          </DialogPrimitive.Description>
          <Command loop label="Command palette">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <span className="label-mono text-signal">⌘K</span>
              <Command.Input
                autoFocus
                placeholder="Go to a page or run an action…"
                className="h-12 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-muted"
              />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-6 text-center text-sm text-muted">
                Nothing matches.
              </Command.Empty>
              <Command.Group heading="ACTIONS" className={group}>
                {suites.data?.map((suite) => (
                  <Item
                    key={suite.id}
                    value={`run suite ${suite.name}`}
                    icon={<Play />}
                    onSelect={run(() =>
                      startRun.mutate(suite.id, {
                        onSuccess: ({ runId }) => router.push(`/app/runs/${runId}`),
                        onError: (error) => toast.error(error.message),
                      }),
                    )}
                  >
                    Run suite · {suite.name}
                  </Item>
                ))}
                {targets.data?.map((target) => (
                  <Item
                    key={target.id}
                    value={`red-team ${target.name}`}
                    icon={<Radar />}
                    onSelect={run(() =>
                      startRedteam.mutate(
                        { targetId: target.id },
                        {
                          onSuccess: ({ redteamRunId }) => router.push(`/app/redteam/${redteamRunId}`),
                          onError: (error) => toast.error(error.message),
                        },
                      ),
                    )}
                  >
                    Start red-team · {target.name}
                  </Item>
                ))}
                {current ? (
                  <Item
                    value="create api key"
                    icon={<KeyRound />}
                    onSelect={go(`/app/projects/${current}?tab=settings`)}
                  >
                    Create API key
                  </Item>
                ) : null}
                <Item value="new project" icon={<Plus />} onSelect={run(() => setNewProjectOpen(true))}>
                  New project
                </Item>
                <Item value="switch theme dark light" icon={<Moon />} onSelect={run(theme.toggle)}>
                  Switch to {theme.theme === 'dark' ? 'light (paper chart)' : 'dark (night flight)'}
                </Item>
              </Command.Group>
              <Command.Group heading="GO TO" className={group}>
                <Item value="dashboard" icon={<Gauge />} onSelect={go('/app')} hint="G D">
                  Dashboard
                </Item>
                {projects.data?.map((project) => (
                  <Item
                    key={project.id}
                    value={`project ${project.name}`}
                    icon={<FolderKanban />}
                    onSelect={go(`/app/projects/${project.id}`)}
                  >
                    {project.name}
                  </Item>
                ))}
                {projects.data?.map((project) => (
                  <Item
                    key={`${project.id}-traces`}
                    value={`traces ${project.name}`}
                    icon={<ScrollText />}
                    onSelect={go(`/app/projects/${project.id}/traces`)}
                  >
                    Traces · {project.name}
                  </Item>
                ))}
                <Item value="settings" icon={<Settings />} onSelect={go('/app/settings')} hint="G S">
                  Settings
                </Item>
                <Item
                  value="keyboard shortcuts help"
                  icon={<Kbd>?</Kbd>}
                  onSelect={run(() => setShortcutsOpen(true))}
                >
                  Keyboard shortcuts
                </Item>
                <Item
                  value="sign out log out"
                  icon={<LogOut />}
                  onSelect={run(() =>
                    logout.mutate(undefined, {
                      onSuccess: () => {
                        disconnectSocket();
                        router.push('/login');
                      },
                    }),
                  )}
                >
                  Sign out
                </Item>
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
