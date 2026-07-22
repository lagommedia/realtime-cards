'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Package } from 'lucide-react';
import { useCollection } from '@/context/CollectionContext';
import CollectionCardTile from '@/components/CollectionCardTile';
import AddCardSheet from '@/components/AddCardSheet';

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export default function CollectionPage() {
  const { cards, removeCard, refreshValue, refreshAll, totalValue, totalCost } = useCollection();
  const [showAdd, setShowAdd] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);

  // Refresh stale values on mount
  useEffect(() => { refreshAll(); }, []);

  const gain = totalValue - totalCost;
  const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;
  const isUp = gain >= 0;

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    try { await refreshAll(); } finally { setRefreshingAll(false); }
  };

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '16px 20px 12px',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>My Collection</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleRefreshAll}
              disabled={refreshingAll}
              style={{
                padding: '8px 12px', borderRadius: 10,
                background: '#f1f5f9', color: '#64748b',
                display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600,
              }}
            >
              <RefreshCw size={14} style={{ animation: refreshingAll ? 'spin 1s linear infinite' : undefined }} />
              Refresh
            </button>
            <button
              onClick={() => setShowAdd(true)}
              style={{
                padding: '8px 14px', borderRadius: 10,
                background: '#1e40af', color: '#fff',
                display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700,
              }}
            >
              <Plus size={15} /> Add Card
            </button>
          </div>
        </div>

        {/* Portfolio summary — only show if there are cards */}
        {cards.length > 0 && (
          <div style={{
            display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 12,
            background: isUp ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${isUp ? '#bbf7d0' : '#fecaca'}`,
          }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Portfolio Value
              </p>
              <p style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{fmt(totalValue)}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Gain/Loss
              </p>
              <p style={{ fontSize: 18, fontWeight: 800, color: isUp ? '#16a34a' : '#dc2626' }}>
                {gain >= 0 ? '+' : ''}{fmt(gain)}
              </p>
              <p style={{ fontSize: 12, color: isUp ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '16px 16px 0' }}>
        {cards.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 14, paddingTop: 80, textAlign: 'center',
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Package size={34} color="#3b82f6" strokeWidth={1.5} />
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>No cards yet</p>
              <p style={{ fontSize: 14, color: '#64748b', maxWidth: 260 }}>
                Add your first card to start tracking values against what you paid.
              </p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              style={{
                padding: '12px 24px', borderRadius: 12,
                background: '#1e40af', color: '#fff',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 700,
              }}
            >
              <Plus size={17} /> Add Your First Card
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
              {cards.length} {cards.length === 1 ? 'card' : 'cards'}
            </p>
            {cards.map(card => (
              <CollectionCardTile
                key={card.id}
                card={card}
                onRemove={() => removeCard(card.id)}
                onRefresh={() => refreshValue(card.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddCardSheet onClose={() => setShowAdd(false)} />}
    </div>
  );
}
