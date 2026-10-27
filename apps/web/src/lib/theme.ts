export type ThemeChoice = 'dark' | 'light' | 'system';
export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'evalpilot-theme';

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): Theme {
  if (choice === 'system') return prefersDark ? 'dark' : 'light';
  return choice;
}

export function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function storeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Private mode or blocked storage: the choice just is not remembered.
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

/**
 * Inline script for <head>: sets data-theme before first paint, so there is no flash of the
 * wrong theme. Kept tiny and dependency-free on purpose.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var c=localStorage.getItem('${THEME_STORAGE_KEY}');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=c==='light'||c==='dark'?c:(d?'dark':'light');document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();`;
