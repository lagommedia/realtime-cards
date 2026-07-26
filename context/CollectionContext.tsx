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
  variant: string | null;
  purchasePrice: number;
  purchaseDate: string;
  photoDataUrl: string | null;
  photoBackDataUrl: string | null;
  notes: string | null;
  currentValue: number | null;
  lastChecked: string | null;
  priceHistory: { date: string; value: number }[];
}

interface CollectionContextValue {
  cards: CollectionCard[];
  loading: boolean;
  addCard: (data: Omit<CollectionCard, 'id' | 'addedAt' | 'currentValue' | 'lastChecked' | 'priceHistory'>) => Promise<void>;
  removeCard: (id: string) => void;
  refreshValue: (id: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  totalValue: number;
  totalCost: number;
}

const CollectionContext = createContext<CollectionContextValue>({
  cards: [],
  loading: false,
  addCard: async () => {},
  removeCard: () => {},
  refreshValue: async () => {},
  refreshAll: async () => {},
  totalValue: 0,
  totalCost: 0,
});

const STALE_MS = 6 * 60 * 60 * 1000; // 6 hours

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

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/collection')
      .then(r => r.ok ? r.json() : { cards: [] })
      .then(({ cards: fetched }: { cards: CollectionCard[] }) => setCards(fetched ?? []))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, []);

  const addCard = async (data: Omit<CollectionCard, 'id' | 'addedAt' | 'currentValue' | 'lastChecked' | 'priceHistory'>) => {
    // Optimistically compute market value client-side before saving
    const tempCard = { ...data, id: '', addedAt: '', currentValue: null, lastChecked: null, priceHistory: [] };
    const value = await fetchMarketValue(tempCard as CollectionCard);
    const now = new Date().toISOString();

    const payload = {
      ...data,
      currentValue: value ?? null,
      lastChecked: value !== null ? now : null,
      priceHistory: value !== null ? [{ date: now, value }] : [],
    };

    const res = await fetch('/api/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to save card');
    const { card } = await res.json() as { card: CollectionCard };
    setCards(prev => [card, ...prev]);
  };

  const removeCard = async (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
    await fetch(`/api/collection/${id}`, { method: 'DELETE' });
  };

  const refreshValue = async (id: string) => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    const value = await fetchMarketValue(card);
    if (value === null) return;

    const res = await fetch(`/api/collection/${id}/refresh`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentValue: value }),
    });
    if (!res.ok) return;
    const { currentValue, lastChecked, priceHistory } = await res.json() as {
      currentValue: number; lastChecked: string; priceHistory: { date: string; value: number }[];
    };
    setCards(prev => prev.map(c => c.id !== id ? c : { ...c, currentValue, lastChecked, priceHistory }));
  };

  const refreshAll = async () => {
    const now = Date.now();
    const stale = cards.filter(c => !c.lastChecked || now - new Date(c.lastChecked).getTime() > STALE_MS);
    await Promise.allSettled(stale.map(c => refreshValue(c.id)));
  };

  const totalValue = cards.reduce((s, c) => s + (c.currentValue ?? 0), 0);
  const totalCost  = cards.reduce((s, c) => s + c.purchasePrice, 0);

  return (
    <CollectionContext.Provider value={{ cards, loading, addCard, removeCard, refreshValue, refreshAll, totalValue, totalCost }}>
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection() {
  return useContext(CollectionContext);
}
