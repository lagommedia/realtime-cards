'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Check } from 'lucide-react';

interface Props {
  imageDataUrl: string;
  onApply: (croppedDataUrl: string) => void;
  onSkip: () => void;
}

interface Box { x: number; y: number; w: number; h: number; }
type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move';

const MIN = 50;
const HANDLE_HIT = 24;

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// Returns the actual rendered image rect inside a contain-fitted img element
function getImageRect(img: HTMLImageElement, container: HTMLElement): Box {
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  const nw = img.naturalWidth  || cw;
  const nh = img.naturalHeight || ch;
  const imgAspect = nw / nh;
  const cAspect   = cw / ch;
  let dw: number, dh: number, dx: number, dy: number;
  if (imgAspect > cAspect) {
    dw = cw; dh = cw / imgAspect; dx = 0; dy = (ch - dh) / 2;
  } else {
    dh = ch; dw = ch * imgAspect; dx = (cw - dw) / 2; dy = 0;
  }
  return { x: dx, y: dy, w: dw, h: dh };
}

export default function CropSheet({ imageDataUrl, onApply, onSkip }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef       = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Box | null>(null);

  const dragRef = useRef<{
    handle: Handle;
    startX: number; startY: number;
    startCrop: Box;
    imgRect: Box;
  } | null>(null);

  const initCrop = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return;
    const r = getImageRect(img, container);
    // Default: full image selected
    setCrop({ x: r.x, y: r.y, w: r.w, h: r.h });
  }, []);

  useEffect(() => {
    if (imgRef.current?.complete) initCrop();
  }, [initCrop]);

  // ── Pointer events ─────────────────────────────────────────────
  const hitHandle = useCallback((px: number, py: number, c: Box): Handle | null => {
    const corners: { h: Handle; cx: number; cy: number }[] = [
      { h: 'nw', cx: c.x,       cy: c.y       },
      { h: 'ne', cx: c.x + c.w, cy: c.y       },
      { h: 'sw', cx: c.x,       cy: c.y + c.h },
      { h: 'se', cx: c.x + c.w, cy: c.y + c.h },
    ];
    for (const { h, cx, cy } of corners) {
      if (Math.abs(px - cx) <= HANDLE_HIT && Math.abs(py - cy) <= HANDLE_HIT) return h;
    }
    if (px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h) return 'move';
    return null;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!crop || !containerRef.current || !imgRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const handle = hitHandle(px, py, crop);
    if (!handle) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      handle,
      startX: px, startY: py,
      startCrop: { ...crop },
      imgRect: getImageRect(imgRef.current, containerRef.current),
    };
  }, [crop, hitHandle]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const dx = px - d.startX;
    const dy = py - d.startY;
    const { startCrop: s, imgRect: r, handle } = d;

    setCrop(() => {
      let { x, y, w, h } = s;
      if (handle === 'move') {
        x = clamp(x + dx, r.x, r.x + r.w - w);
        y = clamp(y + dy, r.y, r.y + r.h - h);
      } else {
        if (handle === 'nw') {
          const nx = clamp(x + dx, r.x, x + w - MIN);
          const ny = clamp(y + dy, r.y, y + h - MIN);
          w += x - nx; h += y - ny; x = nx; y = ny;
        } else if (handle === 'ne') {
          const ny = clamp(y + dy, r.y, y + h - MIN);
          h += y - ny; y = ny;
          w = clamp(w + dx, MIN, r.x + r.w - x);
        } else if (handle === 'sw') {
          const nx = clamp(x + dx, r.x, x + w - MIN);
          w += x - nx; x = nx;
          h = clamp(h + dy, MIN, r.y + r.h - y);
        } else {
          w = clamp(w + dx, MIN, r.x + r.w - x);
          h = clamp(h + dy, MIN, r.y + r.h - y);
        }
      }
      return { x, y, w, h };
    });
  }, []);

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  // ── Apply crop ─────────────────────────────────────────────────
  const applyCrop = useCallback(() => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container || !crop) { onSkip(); return; }
    const r = getImageRect(img, container);
    const scaleX = img.naturalWidth  / r.w;
    const scaleY = img.naturalHeight / r.h;
    const sx = (crop.x - r.x) * scaleX;
    const sy = (crop.y - r.y) * scaleY;
    const sw = crop.w * scaleX;
    const sh = crop.h * scaleY;
    const MAX = 900;
    const scale = Math.min(1, MAX / Math.max(sw, sh));
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    onApply(canvas.toDataURL('image/jpeg', 0.85));
  }, [crop, onApply, onSkip]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* Hint */}
      <div style={{ padding: '14px 20px 10px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
          Drag corners to crop · drag inside to move
        </p>
      </div>

      {/* Image + crop overlay */}
      <div
        ref={containerRef}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          ref={imgRef}
          src={imageDataUrl}
          alt="Crop"
          onLoad={initCrop}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none' }}
        />

        {crop && (
          <>
            {/* Dark mask — 4 panels */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: crop.y, background: 'rgba(0,0,0,0.58)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: crop.y + crop.h, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.58)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: crop.y, left: 0, width: crop.x, height: crop.h, background: 'rgba(0,0,0,0.58)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: crop.y, left: crop.x + crop.w, right: 0, height: crop.h, background: 'rgba(0,0,0,0.58)', pointerEvents: 'none' }} />

            {/* Crop border */}
            <div style={{ position: 'absolute', left: crop.x, top: crop.y, width: crop.w, height: crop.h, border: '2px solid rgba(255,255,255,0.9)', pointerEvents: 'none' }}>
              {/* Rule-of-thirds grid */}
              {[1, 2].map(n => (
                <div key={`v${n}`} style={{ position: 'absolute', left: `${n * 33.33}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.25)' }} />
              ))}
              {[1, 2].map(n => (
                <div key={`h${n}`} style={{ position: 'absolute', top: `${n * 33.33}%`, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.25)' }} />
              ))}
            </div>

            {/* Corner handles */}
            {([['nw', crop.x, crop.y], ['ne', crop.x + crop.w, crop.y], ['sw', crop.x, crop.y + crop.h], ['se', crop.x + crop.w, crop.y + crop.h]] as const).map(([h, hx, hy]) => (
              <div
                key={h}
                style={{
                  position: 'absolute',
                  left: hx - 14, top: hy - 14,
                  width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: `${h}-resize`,
                  pointerEvents: 'none',
                }}
              >
                <div style={{ width: 16, height: 16, background: '#fff', borderRadius: 4, boxShadow: '0 1px 6px rgba(0,0,0,0.6)' }} />
              </div>
            ))}
          </>
        )}
      </div>

      {/* Buttons */}
      <div style={{
        padding: '14px 20px max(20px, env(safe-area-inset-bottom))',
        background: '#111',
        display: 'flex', gap: 12,
      }}>
        <button
          onClick={onSkip}
          style={{ flex: 1, padding: '14px', borderRadius: 14, background: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 600, fontSize: 15 }}
        >
          Skip
        </button>
        <button
          onClick={applyCrop}
          style={{
            flex: 2, padding: '14px', borderRadius: 14, background: '#1e40af', color: '#fff',
            fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Check size={18} /> Use Crop
        </button>
      </div>
    </div>
  );
}
