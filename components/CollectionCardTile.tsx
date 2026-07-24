'use client';

import { useState } from 'react';
import { RefreshCw, Trash2, TrendingUp, TrendingDown, Minus, ImageOff, ChevronDown, ChevronUp } from 'lucide-react';
import { CollectionCard } from '@/context/CollectionContext';
import CardSoldChart from '@/components/CardSoldChart';

interface Props {
  card: CollectionCard;
  onRemove: () => void;
  onRefresh: () => Promise<void>;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CollectionCardTile({ card, onRemove, onRefresh }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showBack, setShowBack] = useState(false);

  const gain = card.currentValue !== null ? card.currentValue - card.purchasePrice : null;
  const gainPct = gain !== null && card.purchasePrice > 0 ? (gain / card.purchasePrice) * 100 : null;

  const isUp = gain !== null && gain > 0;
  const isDown = gain !== null && gain < 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      background: '#fff', border: '1px solid #e2e8f0',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', gap: 12, padding: '12px 14px' }}>
        {/* Photo — tappable to flip if back exists */}
        <div
          onClick={() => card.photoBackDataUrl && setShowBack(s => !s)}
          style={{
            width: 64, height: 90, flexShrink: 0, borderRadius: 8,
            overflow: 'hidden', background: '#f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: card.photoBackDataUrl ? 'pointer' : 'default',
            position: 'relative',
          }}
        >
          {(showBack ? card.photoBackDataUrl : card.photoDataUrl) ? (
            <img
              src={(showBack ? card.photoBackDataUrl : card.photoDataUrl)!}
              alt={card.playerName}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.18s ease' }}
            />
          ) : (
            <ImageOff size={22} color="#cbd5e1" />
          )}
          {card.photoBackDataUrl && (
            <div style={{
              position: 'absolute', bottom: 3, right: 3,
              background: 'rgba(0,0,0,0.52)', borderRadius: 4,
              padding: '1px 4px', fontSize: 8, fontWeight: 700, color: '#fff',
            }}>
              {showBack ? 'BACK' : 'FRONT'}
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {card.playerName}
          </p>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
            {[card.year, card.set, card.variant, card.grade].filter(Boolean).join(' · ')}
          </p>

          {/* Value row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <div>
              <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Est. Value</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                {card.currentValue !== null ? fmt(card.currentValue) : '—'}
              </p>
            </div>
            {gain !== null && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2,
                color: isUp ? '#16a34a' : isDown ? '#dc2626' : '#64748b',
              }}>
                {isUp ? <TrendingUp size={13} /> : isDown ? <TrendingDown size={13} /> : <Minus size={13} />}
                <span style={{ fontSize: 12, fontWeight: 700 }}>
                  {gain >= 0 ? '+' : ''}{fmt(gain)}
                  {gainPct !== null && ` (${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}%)`}
                </span>
              </div>
            )}
          </div>

          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            Paid {fmt(card.purchasePrice)} · {fmtDate(card.purchaseDate)}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ padding: 6, color: '#94a3b8' }}
          >
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ padding: 6, color: '#94a3b8' }}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Expanded: price chart + delete */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '12px 14px 14px' }}>
          <CardSoldChart card={card} />

          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              {card.notes && (
                <p style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginBottom: 4 }}>"{card.notes}"</p>
              )}
              {card.lastChecked && (
                <p style={{ fontSize: 11, color: '#94a3b8' }}>
                  Last updated {fmtDate(card.lastChecked)}
                </p>
              )}
            </div>
            <button
              onClick={onRemove}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                color: '#ef4444', fontSize: 13, fontWeight: 600, flexShrink: 0,
              }}
            >
              <Trash2 size={13} /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
