'use client';

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

interface DeckState {
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  newProjectOpen: boolean;
  setNewProjectOpen: (open: boolean) => void;
}

const DeckContext = createContext<DeckState | null>(null);

export function DeckProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const value = useMemo(
    () => ({
      projectId,
      setProjectId,
      paletteOpen,
      setPaletteOpen,
      shortcutsOpen,
      setShortcutsOpen,
      newProjectOpen,
      setNewProjectOpen,
    }),
    [projectId, paletteOpen, shortcutsOpen, newProjectOpen],
  );
  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export function useDeck(): DeckState {
  const value = useContext(DeckContext);
  if (!value) throw new Error('useDeck must be used inside <DeckProvider>');
  return value;
}

/** Pages call this so the status bar and command palette know the current project. */
export function useCurrentProject(projectId: string | null | undefined): void {
  const { setProjectId } = useDeck();
  useEffect(() => {
    if (projectId) setProjectId(projectId);
  }, [projectId, setProjectId]);
}
