'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getTeamTheme } from '@/lib/team-themes';
import { TeamTheme } from '@/types';

interface TeamContextValue {
  selectedTeamId: number | null;
  setSelectedTeamId: (id: number | null) => void;
  theme: TeamTheme;
}

const TeamContext = createContext<TeamContextValue | null>(null);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [selectedTeamId, setSelectedTeamIdState] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('selectedTeamId');
    if (stored) setSelectedTeamIdState(parseInt(stored, 10));
  }, []);

  const setSelectedTeamId = (id: number | null) => {
    setSelectedTeamIdState(id);
    if (id === null) localStorage.removeItem('selectedTeamId');
    else localStorage.setItem('selectedTeamId', String(id));
  };

  const theme = getTeamTheme(selectedTeamId);

  return (
    <TeamContext.Provider value={{ selectedTeamId, setSelectedTeamId, theme }}>
      <div
        style={{
          '--color-primary': theme.primary,
          '--color-secondary': theme.secondary,
          '--color-accent': theme.accent,
          '--color-bg': theme.background,
          '--color-card-bg': theme.cardBackground,
        } as React.CSSProperties}
      >
        {children}
      </div>
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be used inside TeamProvider');
  return ctx;
}
