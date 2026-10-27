'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useProjects } from '@/lib/queries';
import { Dialog, DialogContent } from '../ui/dialog';
import { Kbd } from '../ui/misc';
import { useDeck } from './deck-context';

/** Event the suite page listens for, so `r` starts a run there. */
export const RUN_SHORTCUT_EVENT = 'evalpilot:run';

export const SHORTCUTS: [string[], string][] = [
  [['⌘', 'K'], 'Command palette'],
  [['G', 'D'], 'Go to dashboard'],
  [['G', 'P'], 'Go to your first project'],
  [['G', 'S'], 'Go to settings'],
  [['R'], 'Run the suite (on a suite page)'],
  [['/'], 'Search traces (on the traces page)'],
  [['?'], 'Show this help'],
];

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(
    element && (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)),
  );
}

/** Global keyboard shortcuts (vim-style "g" prefix). Ignored while typing in a field. */
export function useGlobalShortcuts(): void {
  const router = useRouter();
  const projects = useProjects();
  const { setPaletteOpen, setShortcutsOpen } = useDeck();

  useEffect(() => {
    let prefix: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (prefix === 'g') {
        prefix = null;
        const firstProject = projects.data?.[0];
        if (key === 'd') router.push('/app');
        else if (key === 's') router.push('/app/settings');
        else if (key === 'p' && firstProject) router.push(`/app/projects/${firstProject.id}`);
        return;
      }
      if (key === 'g') {
        prefix = 'g';
        clearTimeout(timer);
        timer = setTimeout(() => (prefix = null), 1200);
      } else if (event.key === '?') {
        setShortcutsOpen(true);
      } else if (key === 'r') {
        window.dispatchEvent(new CustomEvent(RUN_SHORTCUT_EVENT));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer);
    };
  }, [router, projects.data, setPaletteOpen, setShortcutsOpen]);
}

export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = useDeck();
  return (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent title="Keyboard shortcuts" description="Everything is reachable from the keyboard.">
        <dl className="divide-y divide-line">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={label} className="flex items-center justify-between py-2.5">
              <dt className="text-sm">{label}</dt>
              <dd className="flex gap-1">
                {keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
