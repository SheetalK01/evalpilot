'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api';
import { applyTheme, readChoice, resolveTheme, storeChoice, type Theme, type ThemeChoice } from '@/lib/theme';
import { TooltipProvider } from './ui/tooltip';

interface ThemeContextValue {
  choice: ThemeChoice;
  theme: Theme;
  setChoice: (choice: ThemeChoice) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <Providers>');
  return value;
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>('system');
  const [prefersDark, setPrefersDark] = useState(true);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setChoiceState(readChoice());
    setPrefersDark(media.matches);
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const theme = resolveTheme(choice, prefersDark);
  useEffect(() => applyTheme(theme), [theme]);

  const setChoice = useCallback((next: ThemeChoice) => {
    storeChoice(next);
    setChoiceState(next);
  }, []);
  const toggle = useCallback(() => setChoice(theme === 'dark' ? 'light' : 'dark'), [setChoice, theme]);
  const value = useMemo(() => ({ choice, theme, setChoice, toggle }), [choice, theme, setChoice, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            // Client errors (404, 403…) will not fix themselves; only retry network/server errors.
            retry: (count, error) =>
              count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <TooltipProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: 'panel !rounded-sm !border-line !bg-panel !text-text !font-sans !shadow-none',
                description: '!text-muted',
                success: '[&_[data-icon]]:!text-pass',
                error: '[&_[data-icon]]:!text-fail',
              },
            }}
          />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
