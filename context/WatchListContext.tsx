'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface WatchedPlayer {
  playerId: number;
  playerName: string;
  teamId: number;
  position: string;
  addedAt: number;
}

interface WatchListContextValue {
  watchedPlayers: WatchedPlayer[];
  toggleWatch: (player: Omit<WatchedPlayer, 'addedAt'>) => void;
  isWatched: (playerId: number) => boolean;
}

const WatchListContext = createContext<WatchListContextValue>({
  watchedPlayers: [],
  toggleWatch: () => {},
  isWatched: () => false,
});

const STORAGE_KEY = 'cardtracker-watchlist-v1';

export function WatchListProvider({ children }: { children: ReactNode }) {
  const [watchedPlayers, setWatchedPlayers] = useState<WatchedPlayer[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setWatchedPlayers(JSON.parse(stored) as WatchedPlayer[]);
    } catch {}
  }, []);

  const toggleWatch = (player: Omit<WatchedPlayer, 'addedAt'>) => {
    setWatchedPlayers(prev => {
      const exists = prev.some(p => p.playerId === player.playerId);
      const next = exists
        ? prev.filter(p => p.playerId !== player.playerId)
        : [...prev, { ...player, addedAt: Date.now() }];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const isWatched = (playerId: number) => watchedPlayers.some(p => p.playerId === playerId);

  return (
    <WatchListContext.Provider value={{ watchedPlayers, toggleWatch, isWatched }}>
      {children}
    </WatchListContext.Provider>
  );
}

export function useWatchList() {
  return useContext(WatchListContext);
}
