'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SetCardResult } from '@/types/index';

export interface CollectionCard {
  id: string;
  addedAt: string;
  playerId: number;
  playerName: string;
  teamId: number;
  position: string;
  year: number | null;
  set: string | null;
  grade: string | null;
  purchasePrice: number;
  purchaseDate: string;
  photoDataUrl: string | null;
  photoBackDataUrl: string | null;
  variant: string | null;
  notes: string | null;
  currentValue: number | null;
  lastChecked: string | null;
  // CollX methodology: chronological sold-price snapshots
  priceHistory: { date: string; value: number }[];
}

interface CollectionContextValue {
  cards: CollectionCard[];
  addCard: (data: Omit<CollectionCard, 'id' | 'addedAt' | 'currentValue' | 'lastChecked' | 'priceHistory'>) => Promise<void>;
  removeCard: (id: string) => void;
  refreshValue: (id: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  totalValue: number;
  totalCost: number;
}

const CollectionContext = createContext<CollectionContextValue>({
  cards: [],
  addCard: async () => {},
  removeCard: () => {},
  refreshValue: async () => {},
  refreshAll: async () => {},
  totalValue: 0,
  totalCost: 0,
});

const STORAGE_KEY = 'cardtracker-collection-v1';
const STALE_MS = 6 * 60 * 60 * 1000; // 6 hours

// CollX-style valuation: prefer most-recent sold price (actual market transaction)
// over BIN/ask price, then use the best set match.
async function fetchMarketValue(card: CollectionCard): Promise<number | null> {
  try {
    const params = new URLSearchParams({ name: card.playerName });
    if (card.year) params.set('year', String(card.year));
    const res = await fetch(`/api/player/${card.playerId}/cards?${params}`);
    if (!res.ok) return null;
    const { sets } = await res.json() as { sets: SetCardResult[] };
    if (!sets?.length) return null;
    const match = card.set
      ? (sets.find(s => s.set.toLowerCase().includes(card.set!.toLowerCase())) ?? sets[0])
      : sets[0];
    return match.soldPrice ?? match.binPrice ?? null;
  } catch {
    return null;
  }
}

function persist(cards: CollectionCard[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cards)); } catch {}
}

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<CollectionCard[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CollectionCard[];
        // Backfill photoBackDataUrl for cards saved before front/back was introduced
        setCards(parsed.map(c => ({ ...c, photoBackDataUrl: c.photoBackDataUrl ?? null, variant: c.variant ?? null })));
      }
    } catch {}
  }, []);

  const save = (next: CollectionCard[]) => {
    setCards(next);
    persist(next);
  };

  const addCard = async (data: Omit<CollectionCard, 'id' | 'addedAt' | 'currentValue' | 'lastChecked' | 'priceHistory'>) => {
    const card: CollectionCard = {
      ...data,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
      currentValue: null,
      lastChecked: null,
      priceHistory: [],
    };
    const value = await fetchMarketValue(card);
    if (value !== null) {
      const now = new Date().toISOString();
      card.currentValue = value;
      card.lastChecked = now;
      card.priceHistory = [{ date: now, value }];
    }
    save([card, ...cards]);
  };

  const removeCard = (id: string) => save(cards.filter(c => c.id !== id));

  const refreshValue = async (id: string) => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    const value = await fetchMarketValue(card);
    if (value === null) return;
    const now = new Date().toISOString();
    save(cards.map(c => c.id !== id ? c : {
      ...c,
      currentValue: value,
      lastChecked: now,
      priceHistory: [...c.priceHistory, { date: now, value }].slice(-90),
    }));
  };

  const refreshAll = async () => {
    const now = Date.now();
    const stale = cards.filter(c => !c.lastChecked || now - new Date(c.lastChecked).getTime() > STALE_MS);
    await Promise.allSettled(stale.map(c => refreshValue(c.id)));
  };

  const totalValue = cards.reduce((s, c) => s + (c.currentValue ?? 0), 0);
  const totalCost  = cards.reduce((s, c) => s + c.purchasePrice, 0);

  return (
    <CollectionContext.Provider value={{ cards, addCard, removeCard, refreshValue, refreshAll, totalValue, totalCost }}>
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection() {
  return useContext(CollectionContext);
}
