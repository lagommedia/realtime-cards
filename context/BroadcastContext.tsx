'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface BroadcastContextValue {
  delaySec: number;
  setDelaySec: (sec: number) => void;
}

const BroadcastContext = createContext<BroadcastContextValue | null>(null);

export function BroadcastProvider({ children }: { children: React.ReactNode }) {
  const [delaySec, setDelaySecState] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('broadcastDelaySec');
    if (stored !== null) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n >= 0 && n <= 120) setDelaySecState(n);
    }
  }, []);

  const setDelaySec = (sec: number) => {
    const clamped = Math.max(0, Math.min(120, Math.round(sec)));
    setDelaySecState(clamped);
    localStorage.setItem('broadcastDelaySec', String(clamped));
  };

  return (
    <BroadcastContext.Provider value={{ delaySec, setDelaySec }}>
      {children}
    </BroadcastContext.Provider>
  );
}

export function useBroadcast() {
  const ctx = useContext(BroadcastContext);
  if (!ctx) throw new Error('useBroadcast must be used inside BroadcastProvider');
  return ctx;
}
