'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export const BROADCAST_PLATFORMS = [
  { id: 'ballpark', label: 'At the Ballpark',  sublabel: 'No delay',   delaySec: 0  },
  { id: 'cable',    label: 'Cable / Satellite', sublabel: '~2 sec',     delaySec: 2  },
  { id: 'youtube',  label: 'YouTube TV',        sublabel: '~40 sec',    delaySec: 40 },
  { id: 'hulu',     label: 'Hulu + Live TV',    sublabel: '~40 sec',    delaySec: 40 },
  { id: 'fubotv',   label: 'fuboTV',            sublabel: '~40 sec',    delaySec: 40 },
  { id: 'apple',    label: 'Apple TV+',         sublabel: '~55 sec',    delaySec: 55 },
  { id: 'peacock',  label: 'Peacock',           sublabel: '~55 sec',    delaySec: 55 },
  { id: 'mlbtv',    label: 'MLB.tv',            sublabel: '~85 sec',    delaySec: 85 },
] as const;

export type BroadcastPlatformId = typeof BROADCAST_PLATFORMS[number]['id'];

interface BroadcastContextValue {
  platformId: BroadcastPlatformId | null;
  setPlatformId: (id: BroadcastPlatformId | null) => void;
  delaySec: number;
}

const BroadcastContext = createContext<BroadcastContextValue | null>(null);

export function BroadcastProvider({ children }: { children: React.ReactNode }) {
  const [platformId, setPlatformIdState] = useState<BroadcastPlatformId | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('broadcastPlatform') as BroadcastPlatformId | null;
    if (stored && BROADCAST_PLATFORMS.some(p => p.id === stored)) {
      setPlatformIdState(stored);
    }
  }, []);

  const setPlatformId = (id: BroadcastPlatformId | null) => {
    setPlatformIdState(id);
    if (id === null) localStorage.removeItem('broadcastPlatform');
    else localStorage.setItem('broadcastPlatform', id);
  };

  const platform = BROADCAST_PLATFORMS.find(p => p.id === platformId);
  const delaySec = platform?.delaySec ?? 0;

  return (
    <BroadcastContext.Provider value={{ platformId, setPlatformId, delaySec }}>
      {children}
    </BroadcastContext.Provider>
  );
}

export function useBroadcast() {
  const ctx = useContext(BroadcastContext);
  if (!ctx) throw new Error('useBroadcast must be used inside BroadcastProvider');
  return ctx;
}
