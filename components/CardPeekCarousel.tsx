'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';

export interface PeekCard {
  set: string;
  shortName: string;
  year: number;
  imageUrl?: string;
  itemUrl?: string;
}

interface Props {
  cards: PeekCard[];
  renderFallback: (card: PeekCard, index: number) => React.ReactNode;
  onActiveChange?: (index: number) => void;
  resetKey?: string | number | null;
}

const CARD_RATIO = 0.68;
const GAP = 10;

export default function CardPeekCarousel({ cards, renderFallback, onActiveChange, resetKey }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [containerW, setContainerW] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const activeIdxRef = useRef(0);
  const containerWRef = useRef(0);
  const dragRef = useRef<{ startX: number; startOffset: number } | null>(null);

  function offsetFor(idx: number, W: number): number {
    const cW = W * CARD_RATIO;
    return (W - cW) / 2 - idx * (cW + GAP);
  }

  function snapTrack(idx: number, W: number, animate: boolean) {
    const el = trackRef.current;
    if (!el || W === 0) return;
    el.style.transition = animate
      ? 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      : '';
    el.style.transform = `translateX(${offsetFor(idx, W)}px)`;
  }

  // Measure before first paint so cards never flash at 0-width
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    containerWRef.current = w;
    setContainerW(w);
    snapTrack(activeIdxRef.current, w, false);

    const ro = new ResizeObserver(([entry]) => {
      const nw = entry.contentRect.width;
      containerWRef.current = nw;
      setContainerW(nw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-snap without animation on resize
  useLayoutEffect(() => {
    snapTrack(activeIdxRef.current, containerW, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerW]);

  // Animated snap + notify parent when index changes
  useEffect(() => {
    activeIdxRef.current = activeIdx;
    snapTrack(activeIdx, containerWRef.current, true);
    onActiveChange?.(activeIdx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  // Reset to first card when key changes
  useEffect(() => {
    activeIdxRef.current = 0;
    setActiveIdx(0);
  }, [resetKey]);

  const cardW = containerW * CARD_RATIO;

  return (
    <div
      ref={containerRef}
      style={{ overflow: 'hidden', position: 'relative' }}
      onTouchStart={e => {
        if (!trackRef.current) return;
        trackRef.current.style.transition = '';
        dragRef.current = {
          startX: e.touches[0].clientX,
          startOffset: offsetFor(activeIdxRef.current, containerWRef.current),
        };
      }}
      onTouchMove={e => {
        if (!dragRef.current || !trackRef.current) return;
        const dx = e.touches[0].clientX - dragRef.current.startX;
        trackRef.current.style.transform = `translateX(${dragRef.current.startOffset + dx}px)`;
      }}
      onTouchEnd={e => {
        if (!dragRef.current) return;
        const dx = dragRef.current.startX - e.changedTouches[0].clientX;
        dragRef.current = null;
        const idx = activeIdxRef.current;
        const W = containerWRef.current;
        if (Math.abs(dx) < 8) {
          snapTrack(idx, W, true);
          const card = cards[idx];
          if (card?.itemUrl) window.location.href = card.itemUrl;
        } else if (dx > 40 && idx < cards.length - 1) {
          setActiveIdx(idx + 1);
        } else if (dx < -40 && idx > 0) {
          setActiveIdx(idx - 1);
        } else {
          snapTrack(idx, W, true);
        }
      }}
    >
      {/* Sliding track */}
      <div ref={trackRef} style={{ display: 'flex', gap: GAP, willChange: 'transform' }}>
        {cards.map((card, i) => (
          <div
            key={`${card.set}-${i}`}
            style={{
              width: cardW > 0 ? cardW : undefined,
              flexShrink: 0,
              aspectRatio: '9/12',
              borderRadius: 12,
              overflow: 'hidden',
              position: 'relative',
              backgroundColor: '#0a0f1e',
              opacity: i === activeIdx ? 1 : 0.45,
              transform: i === activeIdx ? 'scale(1)' : 'scale(0.93)',
              transition: 'opacity 0.28s ease, transform 0.28s ease',
              boxShadow: i === activeIdx ? '0 8px 32px rgba(0,0,0,0.6)' : '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            {card.imageUrl ? (
              <img
                src={card.imageUrl}
                alt={`${card.set} RC`}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
            ) : (
              renderFallback(card, i)
            )}
          </div>
        ))}
      </div>

      {/* Position counter */}
      {cards.length > 1 && (
        <div style={{
          position: 'absolute', bottom: 8,
          right: `calc(${((1 - CARD_RATIO) / 2) * 100}% + 8px)`,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
          color: '#fff', fontSize: 10, fontWeight: 700,
          padding: '2px 8px', borderRadius: 99,
          pointerEvents: 'none',
        }}>
          {activeIdx + 1} / {cards.length}
        </div>
      )}
    </div>
  );
}
