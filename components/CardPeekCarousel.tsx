'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

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
  overlayRenderer?: (card: PeekCard, index: number, isActive: boolean) => React.ReactNode;
  onActiveChange?: (index: number) => void;
  resetKey?: string | number | null;
}

const CARD_RATIO = 0.68;
const GAP = 10;

export default function CardPeekCarousel({ cards, renderFallback, overlayRenderer, onActiveChange, resetKey }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [containerW, setContainerW] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Fullscreen state
  const [fullscreen, setFullscreen] = useState<number | null>(null);
  const [fsIdx, setFsIdx] = useState(0);

  // Mini carousel refs
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const activeIdxRef = useRef(0);
  const containerWRef = useRef(0);
  const dragRef = useRef<{ startX: number; startOffset: number } | null>(null);

  // Fullscreen carousel refs
  const fsTrackRef = useRef<HTMLDivElement>(null);
  const fsIdxRef = useRef(0);
  const fsDragRef = useRef<{ startX: number; startOffset: number } | null>(null);
  const fsFirstSnap = useRef(true);

  useEffect(() => { setMounted(true); }, []);

  // ── Mini carousel helpers ──────────────────────────────────────────────────

  function offsetFor(idx: number, W: number): number {
    const cW = W * CARD_RATIO;
    return (W - cW) / 2 - idx * (cW + GAP);
  }

  function snapTrack(idx: number, W: number, animate: boolean) {
    const el = trackRef.current;
    if (!el || W === 0) return;
    el.style.transition = animate ? 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : '';
    el.style.transform = `translateX(${offsetFor(idx, W)}px)`;
  }

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

  useLayoutEffect(() => {
    snapTrack(activeIdxRef.current, containerW, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerW]);

  useEffect(() => {
    activeIdxRef.current = activeIdx;
    snapTrack(activeIdx, containerWRef.current, true);
    onActiveChange?.(activeIdx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  useEffect(() => {
    activeIdxRef.current = 0;
    setActiveIdx(0);
  }, [resetKey]);

  // ── Fullscreen helpers ────────────────────────────────────────────────────

  function snapFsTrack(idx: number, animate: boolean) {
    const el = fsTrackRef.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : '';
    el.style.transform = `translateX(${-idx * window.innerWidth}px)`;
  }

  // Single effect handles both open-to-card and swipe-within-fullscreen
  useEffect(() => {
    if (fullscreen === null) {
      fsFirstSnap.current = true;
      return;
    }
    fsIdxRef.current = fsIdx;
    const shouldAnimate = !fsFirstSnap.current;
    fsFirstSnap.current = false;
    requestAnimationFrame(() => snapFsTrack(fsIdx, shouldAnimate));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, fsIdx]);

  // Lock body scroll while fullscreen is open
  useEffect(() => {
    if (fullscreen !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [fullscreen]);

  function openFullscreen(idx: number) {
    fsFirstSnap.current = true;
    setFsIdx(idx);
    fsIdxRef.current = idx;
    setFullscreen(idx);
  }

  function closeFullscreen() {
    setActiveIdx(fsIdxRef.current);
    setFullscreen(null);
  }

  const cardW = containerW * CARD_RATIO;

  return (
    <>
      {/* ── Mini carousel ─────────────────────────────────────────────────── */}
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
          } else if (dx > 40 && idx < cards.length - 1) {
            setActiveIdx(idx + 1);
          } else if (dx < -40 && idx > 0) {
            setActiveIdx(idx - 1);
          } else {
            snapTrack(idx, W, true);
          }
        }}
      >
        <div ref={trackRef} style={{ display: 'flex', gap: GAP, willChange: 'transform' }}>
          {cards.map((card, i) => (
            <div
              key={`${card.set}-${i}`}
              style={{
                width: cardW > 0 ? cardW : `${CARD_RATIO * 100}%`,
                flexShrink: 0,
                borderRadius: 12,
                overflow: 'hidden',
                backgroundColor: '#0a0f1e',
                opacity: i === activeIdx ? 1 : 0.45,
                transform: i === activeIdx ? 'scale(1)' : 'scale(0.93)',
                transition: 'opacity 0.28s ease, transform 0.28s ease',
                boxShadow: i === activeIdx ? '0 8px 32px rgba(0,0,0,0.6)' : '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              {/* Image — tap to open fullscreen */}
              <div
                style={{ aspectRatio: '9/12', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => openFullscreen(i)}
              >
                {card.imageUrl ? (
                  <img
                    src={card.imageUrl}
                    alt={`${card.set} RC`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  renderFallback(card, i)
                )}
              </div>
              {overlayRenderer && overlayRenderer(card, i, i === activeIdx)}
            </div>
          ))}
        </div>

        {cards.length > 1 && (
          <div style={{
            position: 'absolute', top: 10,
            right: `calc(${((1 - CARD_RATIO) / 2) * 100}% + 10px)`,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
            color: '#fff', fontSize: 10, fontWeight: 700,
            padding: '2px 8px', borderRadius: 99,
            pointerEvents: 'none',
          }}>
            {activeIdx + 1} / {cards.length}
          </div>
        )}
      </div>

      {/* ── Fullscreen modal ──────────────────────────────────────────────── */}
      {mounted && fullscreen !== null && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.97)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
          }}
          onTouchStart={e => {
            if (!fsTrackRef.current) return;
            fsTrackRef.current.style.transition = '';
            fsDragRef.current = {
              startX: e.touches[0].clientX,
              startOffset: -fsIdxRef.current * window.innerWidth,
            };
          }}
          onTouchMove={e => {
            if (!fsDragRef.current || !fsTrackRef.current) return;
            const dx = e.touches[0].clientX - fsDragRef.current.startX;
            fsTrackRef.current.style.transform = `translateX(${fsDragRef.current.startOffset + dx}px)`;
          }}
          onTouchEnd={e => {
            if (!fsDragRef.current) return;
            const dx = fsDragRef.current.startX - e.changedTouches[0].clientX;
            fsDragRef.current = null;
            const idx = fsIdxRef.current;
            if (Math.abs(dx) < 8) {
              snapFsTrack(idx, true);
            } else if (dx > 40 && idx < cards.length - 1) {
              setFsIdx(idx + 1);
            } else if (dx < -40 && idx > 0) {
              setFsIdx(idx - 1);
            } else {
              snapFsTrack(idx, true);
            }
          }}
        >
          {/* Header: counter + X */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '52px 20px 8px',
            flexShrink: 0,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 600 }}>
              {cards.length > 1 ? `${fsIdx + 1} / ${cards.length}` : ''}
            </span>
            <button
              onClick={closeFullscreen}
              style={{
                width: 36, height: 36,
                borderRadius: 99,
                backgroundColor: 'rgba(255,255,255,0.14)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <X size={20} color="white" />
            </button>
          </div>

          {/* Sliding fullscreen track */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div
              ref={fsTrackRef}
              style={{ display: 'flex', height: '100%', willChange: 'transform' }}
            >
              {cards.map((card, i) => (
                <div
                  key={`fs-${card.set}-${i}`}
                  style={{
                    width: '100vw',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '8px 16px 24px',
                  }}
                >
                  {/* Card image — fills remaining height */}
                  <div style={{
                    flex: 1,
                    position: 'relative',
                    borderRadius: 14,
                    overflow: 'hidden',
                    backgroundColor: '#0a0f1e',
                    marginBottom: 12,
                    minHeight: 0,
                  }}>
                    {card.imageUrl ? (
                      <img
                        src={card.imageUrl}
                        alt={`${card.set} RC`}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%' }}>
                        {renderFallback(card, i)}
                      </div>
                    )}
                  </div>

                  {/* Buy It Now panel */}
                  {overlayRenderer && (
                    <div style={{ flexShrink: 0, borderRadius: 12, overflow: 'hidden' }}>
                      {overlayRenderer(card, i, i === fsIdx)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
