'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../providers';
import { Tooltip } from '../ui/tooltip';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <Tooltip content={`Switch to ${next === 'dark' ? 'night flight' : 'paper chart'}`}>
      <button
        type="button"
        onClick={toggle}
        data-testid="theme-toggle"
        aria-label={`Switch to ${next} theme`}
        className={`inline-flex size-8 items-center justify-center rounded-sm text-muted transition-colors hover:bg-panel-2 hover:text-text ${className ?? ''}`}
      >
        {theme === 'dark' ? (
          <Sun className="size-4" strokeWidth={1.5} />
        ) : (
          <Moon className="size-4" strokeWidth={1.5} />
        )}
      </button>
    </Tooltip>
  );
}
