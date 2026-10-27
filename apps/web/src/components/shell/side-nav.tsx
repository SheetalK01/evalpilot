'use client';

import { FolderKanban, Gauge, Plus, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useProjects } from '@/lib/queries';
import { Scan } from '../instruments/states';
import { Kbd } from '../ui/misc';
import { useDeck } from './deck-context';

function NavLink({
  href,
  active,
  children,
  testId,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm transition-colors [&_svg]:size-4 [&_svg]:stroke-[1.5]',
        active ? 'bg-panel-2 text-text' : 'text-muted hover:bg-panel-2/60 hover:text-text',
      )}
    >
      {active ? (
        <span aria-hidden className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-signal" />
      ) : null}
      {children}
    </Link>
  );
}

export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const projects = useProjects();
  const { setNewProjectOpen, setShortcutsOpen, projectId } = useDeck();

  return (
    <nav
      aria-label="App"
      className="flex h-full flex-col gap-6 p-3"
      onClick={(e) => (e.target as HTMLElement).closest('a') && onNavigate?.()}
    >
      <div className="space-y-1">
        <div className="label-mono px-2.5 pb-1.5">FLIGHT DECK</div>
        <NavLink href="/app" active={pathname === '/app'} testId="nav-dashboard">
          <Gauge /> Dashboard
        </NavLink>
        <NavLink href="/app/settings" active={pathname.startsWith('/app/settings')} testId="nav-settings">
          <Settings /> Settings
        </NavLink>
      </div>
      <div className="min-h-0 flex-1 space-y-1">
        <div className="flex items-center justify-between px-2.5 pb-1.5">
          <span className="label-mono">PROJECTS</span>
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            className="rounded-xs p-1 text-muted hover:bg-panel-2 hover:text-text"
            aria-label="New project"
            data-testid="nav-new-project"
          >
            <Plus className="size-3.5" strokeWidth={1.5} />
          </button>
        </div>
        {projects.isLoading ? (
          <div className="space-y-2 px-2.5">
            <Scan className="h-7" />
            <Scan className="h-7" />
          </div>
        ) : (
          <div className="max-h-[50vh] space-y-0.5 overflow-y-auto">
            {projects.data?.map((project) => (
              <NavLink
                key={project.id}
                href={`/app/projects/${project.id}`}
                active={
                  projectId === project.id && !pathname.startsWith('/app/settings') && pathname !== '/app'
                }
                testId="project-card"
              >
                <FolderKanban /> <span className="truncate">{project.name}</span>
              </NavLink>
            ))}
            {projects.data?.length === 0 ? (
              <p className="px-2.5 text-[13px] text-muted">No projects yet.</p>
            ) : null}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setShortcutsOpen(true)}
        className="flex items-center justify-between rounded-sm border border-line px-2.5 py-2 text-[12px] text-muted hover:border-line-strong hover:text-text"
      >
        Keyboard shortcuts <Kbd>?</Kbd>
      </button>
    </nav>
  );
}
