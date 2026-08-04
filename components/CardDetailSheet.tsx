'use client';

import { useState, useRef, useEffect } from 'react';
import {
  X, TrendingUp, TrendingDown, Minus, RefreshCw,
  ImageOff, Copy, ExternalLink, Check, ChevronDown,
} from 'lucide-react';
import { CollectionCard } from '@/context/CollectionContext';
import CardSoldChart from '@/components/CardSoldChart';

interface Props {
  card: CollectionCard;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function buildListingTitle(card: CollectionCard): string {
  return [
    card.year,
    card.set,
    card.playerName,
    card.variant || null,
    card.grade && card.grade !== 'Raw' ? card.grade : null,
    'Baseball Card',
  ].filter(Boolean).join(' ');
}

function gradeToCondition(grade: string | null): string {
  if (!grade || grade === 'Raw') return 'Used';
  if (/10|gem|pristine/i.test(grade)) return 'Like New';
  if (/9\.5|9/i.test(grade)) return 'Very Good';
  return 'Good';
}

export default function CardDetailSheet({ card, onClose, onRefresh }: Props) {
  const [showBack,      setShowBack]      = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [showSellSheet, setShowSellSheet] = useState(false);
  const [copied,        setCopied]        = useState(false);
  const bottomSheetRef = useRef<HTMLDivElement>(null);

  // Auto-scroll bottom sheet to reveal sell panel when it opens
  useEffect(() => {
    if (showSellSheet) {
      setTimeout(() => {
        bottomSheetRef.current?.scrollTo({ top: bottomSheetRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  }, [showSellSheet]);

  const gain    = card.currentValue !== null ? card.currentValue - card.purchasePrice : null;
  const gainPct = gain !== null && card.purchasePrice > 0 ? (gain / card.purchasePrice) * 100 : null;
  const isUp    = gain !== null && gain > 0;
  const isDown  = gain !== null && gain < 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };

  const listingTitle      = buildListingTitle(card);
  const recommendedPrice  = card.currentValue ? Math.round(card.currentValue * 0.95 * 100) / 100 : null;
  const condition         = gradeToCondition(card.grade);

  const handleCopyTitle = () => {
    navigator.clipboard.writeText(listingTitle).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenEbay = () => {
    window.open('https://www.ebay.com/sl/sell', '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#000', display: 'flex', flexDirection: 'column' }}>

      {/* ── Photo area ── */}
      <div style={{
        flex: 1, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'max(72px, calc(env(safe-area-inset-top) + 56px)) 28px 24px',
      }}>

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 'max(52px, calc(env(safe-area-inset-top) + 12px))',
            left: 16,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
          }}
        >
          <X size={18} />
        </button>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Refresh value"
          style={{
            position: 'absolute',
            top: 'max(52px, calc(env(safe-area-inset-top) + 12px))',
            right: 16,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
          }}
        >
          <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
        </button>

        {/* Photo — contain so full slab/card is always visible */}
        <div
          onClick={() => card.photoBackDataUrl && setShowBack(s => !s)}
          style={{
            maxHeight: '100%', maxWidth: '92%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: card.photoBackDataUrl ? 'pointer' : 'default',
          }}
        >
          {(showBack ? card.photoBackDataUrl : card.photoDataUrl) ? (
            <img
              src={(showBack ? card.photoBackDataUrl : card.photoDataUrl)!}
              alt={card.playerName}
              style={{
                maxWidth: '100%', maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 14,
                boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
              }}
            />
          ) : (
            <div style={{ width: 200, height: 280, background: '#1e293b', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ImageOff size={32} color="#475569" />
            </div>
          )}
        </div>

        {/* Flip hint */}
        {card.photoBackDataUrl && (
          <div style={{
            position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.55)', borderRadius: 99,
            padding: '4px 14px', color: 'rgba(255,255,255,0.75)',
            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
          }}>
            Tap photo to {showBack ? 'see front' : 'flip to back'}
          </div>
        )}
      </div>

      {/* ── Bottom sheet ── */}
      <div ref={bottomSheetRef} style={{
        borderRadius: '24px 24px 0 0',
        background: '#fff',
        padding: '20px 20px max(32px, env(safe-area-inset-bottom))',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
        overflowY: 'auto',
        maxHeight: '60svh',
      }}>
        {/* Card identity */}
        <p style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 2, lineHeight: 1.2 }}>
          {card.playerName}
        </p>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          {[card.year, card.set, card.variant, card.grade].filter(Boolean).join(' · ')}
        </p>

        {/* Value row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {/* Current value */}
          <div style={{
            flex: 1, padding: '14px 16px', borderRadius: 14,
            background: '#f8fafc', border: '1px solid #e2e8f0',
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Est. Value
            </p>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
              {card.currentValue !== null ? fmt(card.currentValue) : '—'}
            </p>
          </div>

          {/* Gain/loss */}
          {gain !== null ? (
            <div style={{
              flex: 1, padding: '14px 16px', borderRadius: 14,
              background: isUp ? '#f0fdf4' : isDown ? '#fef2f2' : '#f8fafc',
              border: `1px solid ${isUp ? '#bbf7d0' : isDown ? '#fecaca' : '#e2e8f0'}`,
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Since Purchase
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {isUp ? <TrendingUp size={15} color="#16a34a" /> : isDown ? <TrendingDown size={15} color="#dc2626" /> : <Minus size={15} color="#64748b" />}
                <p style={{ fontSize: 20, fontWeight: 800, color: isUp ? '#16a34a' : isDown ? '#dc2626' : '#64748b', lineHeight: 1 }}>
                  {gain >= 0 ? '+' : ''}{fmt(gain)}
                </p>
              </div>
              {gainPct !== null && (
                <p style={{ fontSize: 11, color: isUp ? '#16a34a' : isDown ? '#dc2626' : '#64748b', fontWeight: 700, marginTop: 2 }}>
                  {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                </p>
              )}
            </div>
          ) : (
            <div style={{
              flex: 1, padding: '14px 16px', borderRadius: 14,
              background: '#f8fafc', border: '1px solid #e2e8f0',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Paid
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                {fmt(card.purchasePrice)}
              </p>
            </div>
          )}
        </div>

        {/* Purchase info */}
        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 16 }}>
          Paid {fmt(card.purchasePrice)} ·{' '}
          {new Date(card.purchaseDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        {/* Price history chart */}
        <div style={{
          marginBottom: 16, padding: '14px 14px 10px',
          borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0',
        }}>
          <CardSoldChart card={card} height={200} />
        </div>

        {/* Sell on eBay */}
        <button
          onClick={() => setShowSellSheet(s => !s)}
          style={{
            width: '100%', padding: '14px',
            borderRadius: 14,
            background: '#3665f3', color: '#fff',
            fontWeight: 700, fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background 0.15s',
          }}
        >
          <ExternalLink size={17} />
          Sell on eBay
          <ChevronDown size={15} style={{ marginLeft: 'auto', transform: showSellSheet ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }} />
        </button>

        {/* Sell sheet — inline expansion */}
        {showSellSheet && (
          <div style={{
            marginTop: 12, borderRadius: 14,
            border: '1px solid #dbeafe', background: '#eff6ff',
            padding: '16px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Prepared Listing
            </p>

            {/* Title */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>TITLE</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', flex: 1, lineHeight: 1.4 }}>
                  {listingTitle}
                </p>
                <button
                  onClick={handleCopyTitle}
                  style={{
                    padding: '5px 10px', borderRadius: 8,
                    background: copied ? '#16a34a' : '#1d4ed8',
                    color: '#fff', fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 4,
                    flexShrink: 0, transition: 'background 0.2s',
                  }}
                >
                  {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
            </div>

            {/* Price + condition row */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 2 }}>RECOMMENDED PRICE</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#1e40af' }}>
                  {recommendedPrice !== null ? fmt(recommendedPrice) : '—'}
                </p>
                {recommendedPrice !== null && card.currentValue && (
                  <p style={{ fontSize: 10, color: '#3b82f6' }}>5% below est. value for quick sale</p>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 2 }}>CONDITION</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{condition}</p>
                <p style={{ fontSize: 10, color: '#64748b' }}>
                  {card.grade && card.grade !== 'Raw' ? card.grade : 'Ungraded'}
                </p>
              </div>
            </div>

            {/* Open eBay */}
            <button
              onClick={handleOpenEbay}
              style={{
                width: '100%', padding: '12px',
                borderRadius: 12, background: '#1d4ed8', color: '#fff',
                fontWeight: 700, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <ExternalLink size={15} /> Open eBay to List
            </button>
            <p style={{ fontSize: 11, color: '#3b82f6', textAlign: 'center' }}>
              Copy the title above, then paste it into your eBay listing
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
