'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Image as GalleryIcon } from 'lucide-react';
import { enhanceCardImage } from '@/lib/image-enhance';

type CardMode = 'raw' | 'slabbed';

// Width-to-height ratios
const CARD_RATIO: Record<CardMode, number> = {
  raw: 63.5 / 88.9,     // 2.5" × 3.5" standard trading card
  slabbed: 3.5 / 4.625, // PSA/BGS slab outer dimensions
};

const GUIDE_W_PCT = 0.76;
const ARM = 22;  // L-bracket arm length (px)
const THICK = 3; // L-bracket stroke thickness (px)

interface Props {
  side: 'front' | 'back';
  onCapture: (enhancedDataUrl: string) => void;
  onPickFromLibrary: () => void;
  onClose: () => void;
}

const iconBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: '50%',
  background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#fff', flexShrink: 0, border: 'none', cursor: 'pointer',
};

export default function CardCameraSheet({ side, onCapture, onPickFromLibrary, onClose }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const capCanvas  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const rafRef     = useRef<number>(0);
  const prevPx     = useRef<Uint8ClampedArray | null>(null);
  const stableFrom = useRef<number | null>(null);
  const hasSnapped = useRef(false);
  const mountedRef = useRef(true);
  const modeRef    = useRef<CardMode>('raw');

  const [mode, setMode]             = useState<CardMode>('raw');
  const [ready, setReady]           = useState(false);
  const [camErr, setCamErr]         = useState<string | null>(null);
  const [stability, setStability]   = useState(0);
  const [cardInFrame, setCardInFrame] = useState(false);
  const [flashing, setFlashing]     = useState(false);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Camera start ──────────────────────────────────────────────
  useEffect(() => {
    let dead = false;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCamErr('Camera API not available');
      return;
    }

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    }).then(stream => {
      if (dead) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      v.onloadedmetadata = () =>
        v.play().then(() => { if (!dead) setReady(true); }).catch(() => {});
    }).catch(err => {
      if (!dead) setCamErr(err instanceof Error ? err.message : 'Permission denied');
    });

    return () => {
      dead = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Capture frame cropped to guide area ───────────────────────
  const doCapture = useCallback(async () => {
    if (hasSnapped.current) return;
    hasSnapped.current = true;
    cancelAnimationFrame(rafRef.current);

    const v = videoRef.current;
    const c = capCanvas.current;
    if (!v || !c) return;

    const vw = v.clientWidth, vh = v.clientHeight;
    const vidW = v.videoWidth, vidH = v.videoHeight;
    if (!vidW || !vidH) return;

    const ratio  = CARD_RATIO[modeRef.current];
    const guideW = vw * GUIDE_W_PCT;
    const guideH = guideW / ratio;
    const gx = (vw - guideW) / 2;
    const gy = (vh - guideH) / 2;

    // Map display coords → video natural coords (accounting for object-fit: cover)
    const scale = Math.max(vw / vidW, vh / vidH);
    const ox = (vw - vidW * scale) / 2;
    const oy = (vh - vidH * scale) / 2;

    const srcX = Math.round((gx - ox) / scale);
    const srcY = Math.round((gy - oy) / scale);
    const srcW = Math.round(guideW / scale);
    const srcH = Math.round(guideH / scale);

    const outScale = Math.min(1, 1200 / Math.max(srcW, srcH));
    c.width  = Math.round(srcW * outScale);
    c.height = Math.round(srcH * outScale);
    c.getContext('2d')!.drawImage(v, srcX, srcY, srcW, srcH, 0, 0, c.width, c.height);
    const raw = c.toDataURL('image/jpeg', 0.92);

    setFlashing(true);
    setTimeout(() => { if (mountedRef.current) setFlashing(false); }, 180);

    const enhanced = await enhanceCardImage(raw).catch(() => raw);
    if (mountedRef.current) onCapture(enhanced);
  }, [onCapture]);

  // ── Motion stability detection ────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const SAMPLE = 80;
    const tmp = document.createElement('canvas');
    tmp.width = SAMPLE; tmp.height = SAMPLE;
    const tmpCtx = tmp.getContext('2d', { willReadFrequently: true })!;

    const loop = () => {
      const v = videoRef.current;
      if (!v || hasSnapped.current) return;

      tmpCtx.drawImage(v, 0, 0, SAMPLE, SAMPLE);
      const curr = tmpCtx.getImageData(0, 0, SAMPLE, SAMPLE).data;

      // ── Card presence: std dev of luminance in center guide region ──
      // Cards have text, borders, and player photos → high variance.
      // A blank table/wall is uniform → low variance.
      // Check the inner 40% of the sample, which overlaps the guide center.
      const C0 = Math.round(SAMPLE * 0.3);
      const C1 = Math.round(SAMPLE * 0.7);
      let lumSum = 0, lumSumSq = 0, lumCount = 0;
      for (let py = C0; py < C1; py++) {
        for (let px = C0; px < C1; px++) {
          const i = (py * SAMPLE + px) * 4;
          const lum = curr[i] * 0.299 + curr[i + 1] * 0.587 + curr[i + 2] * 0.114;
          lumSum   += lum;
          lumSumSq += lum * lum;
          lumCount++;
        }
      }
      const lumMean  = lumSum / lumCount;
      const lumStdDev = Math.sqrt(lumSumSq / lumCount - lumMean * lumMean);
      const cardPresent = lumStdDev > 18;
      setCardInFrame(cardPresent);

      if (prevPx.current) {
        const prev = prevPx.current;
        let sum = 0;
        for (let i = 0; i < curr.length; i += 4) {
          sum += Math.abs(curr[i]   - prev[i])
               + Math.abs(curr[i+1] - prev[i+1])
               + Math.abs(curr[i+2] - prev[i+2]);
        }
        const mad = sum / (SAMPLE * SAMPLE * 3);
        const isStable = mad < 7;

        // Only count down when a card is visible AND the frame is steady
        if (cardPresent && isStable) {
          if (!stableFrom.current) stableFrom.current = performance.now();
          const s = Math.min(1, (performance.now() - stableFrom.current) / 1500);
          setStability(s);
          if (s >= 1) { doCapture(); return; }
        } else {
          stableFrom.current = null;
          setStability(0);
        }
      }

      prevPx.current = new Uint8ClampedArray(curr);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ready, doCapture]);

  // Brackets are dim when no card detected, white when card present, green when locking
  const cornerColor = stability > 0.7
    ? '#22c55e'
    : stability > 0.2
      ? `rgba(34,197,94,${0.35 + stability * 0.65})`
      : cardInFrame
        ? 'rgba(255,255,255,0.9)'
        : 'rgba(255,255,255,0.35)';

  const ratio = CARD_RATIO[mode];
  const ringR = 40;
  const ringCircumference = 2 * Math.PI * ringR;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#000', overflow: 'hidden' }}>

      {/* Capture flash */}
      {flashing && (
        <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 0.8, zIndex: 20, pointerEvents: 'none' }} />
      )}

      {/* Live camera feed */}
      <video
        ref={videoRef}
        playsInline muted autoPlay
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Subtle vignette to make guide pop */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 72% 58% at 50% 48%, transparent, rgba(0,0,0,0.38) 100%)',
      }} />

      {/* Card guide frame — centered, aspect-ratio locked */}
      {ready && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          // Fit within viewport: never wider than 76vw, never taller than available space
          width: `min(${GUIDE_W_PCT * 100}vw, calc((100svh - 240px) * ${ratio.toFixed(4)}))`,
          aspectRatio: `${ratio}`,
          pointerEvents: 'none',
        }}>

          {/* Top-left bracket */}
          <div style={{ position: 'absolute', top: 0, left: 0 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: ARM, height: THICK, background: cornerColor, borderRadius: 2, transition: 'background 0.25s' }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: THICK, height: ARM, background: cornerColor, borderRadius: 2, transition: 'background 0.25s' }} />
          </div>

          {/* Top-right bracket */}
          <div style={{ position: 'absolute', top: 0, right: 0 }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: ARM, height: THICK, background: cornerColor, borderRadius: 2, transition: 'background 0.25s' }} />
            <div style={{ position: 'absolute', top: 0, right: 0, width: THICK, height: ARM, background: cornerColor, borderRadius: 2, transition: 'background 0.25s' }} />
          </div>

          {/* Bottom-left bracket */}
          <div style={{ position: 'absolute', bottom: 0, left: 0 }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: ARM, height: THICK, background: cornerColor, borderRadius: 2, transition: 'background 0.25s' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: THICK, height: ARM, background: cornerColor, borderRadius: 2, transition: 'background 0.25s' }} />
          </div>

          {/* Bottom-right bracket */}
          <div style={{ position: 'absolute', bottom: 0, right: 0 }}>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: ARM, height: THICK, background: cornerColor, borderRadius: 2, transition: 'background 0.25s' }} />
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: THICK, height: ARM, background: cornerColor, borderRadius: 2, transition: 'background 0.25s' }} />
          </div>

          {/* Status text below guide */}
          <div style={{
            position: 'absolute', top: '100%', left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 14,
            color: stability >= 1
              ? '#22c55e'
              : stability > 0.08
                ? `rgba(255,255,255,${0.5 + stability * 0.5})`
                : cardInFrame
                  ? 'rgba(255,255,255,0.6)'
                  : 'rgba(255,255,255,0.35)',
            fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
            textShadow: '0 1px 6px rgba(0,0,0,0.7)',
            transition: 'color 0.25s',
          }}>
            {stability >= 1
              ? 'Capturing…'
              : stability > 0.08
                ? 'Hold still…'
                : cardInFrame
                  ? 'Card detected — hold steady'
                  : 'Point camera at your card'}
          </div>
        </div>
      )}

      {/* Camera unavailable error */}
      {camErr && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 12, padding: 36,
        }}>
          <p style={{ color: '#fff', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>Camera unavailable</p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
            {camErr.toLowerCase().includes('denied') || camErr.toLowerCase().includes('permission')
              ? 'Allow camera access in your browser or device settings, then try again.'
              : 'Camera access isn\'t available here. You can pick a photo from your library instead.'}
          </p>
          <button
            onClick={() => { onPickFromLibrary(); onClose(); }}
            style={{ marginTop: 8, padding: '13px 28px', borderRadius: 14, background: '#1e40af', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer' }}
          >
            Choose from Library
          </button>
        </div>
      )}

      {/* ── Top bar ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: 'max(52px, calc(env(safe-area-inset-top) + 12px)) 16px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <button onClick={onClose} style={iconBtn} aria-label="Close">
          <X size={20} />
        </button>

        <div style={{
          padding: '7px 18px', borderRadius: 99,
          background: 'rgba(0,0,0,0.55)',
          color: '#fff', fontSize: 13, fontWeight: 700,
        }}>
          {side === 'front' ? 'Front of Card' : 'Back of Card'}
        </div>

        <button
          onClick={() => { onPickFromLibrary(); onClose(); }}
          style={iconBtn}
          aria-label="Choose from library"
        >
          <GalleryIcon size={20} />
        </button>
      </div>

      {/* ── Bottom bar ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '20px 32px max(40px, env(safe-area-inset-bottom))',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
      }}>

        {/* Raw / Slabbed mode toggle */}
        <div style={{
          display: 'flex', gap: 3, padding: 3,
          background: 'rgba(0,0,0,0.55)', borderRadius: 99,
        }}>
          {(['raw', 'slabbed'] as CardMode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); hasSnapped.current = false; stableFrom.current = null; setStability(0); }}
              style={{
                padding: '7px 22px', borderRadius: 99, fontSize: 13, fontWeight: 600,
                background: mode === m ? '#fff' : 'transparent',
                color: mode === m ? '#000' : 'rgba(255,255,255,0.78)',
                border: 'none', cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              {m === 'raw' ? 'Raw' : 'Slabbed'}
            </button>
          ))}
        </div>

        {/* Shutter button with stability progress ring */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg
            width={88} height={88}
            viewBox="0 0 88 88"
            style={{ position: 'absolute', transform: 'rotate(-90deg)', overflow: 'visible' }}
          >
            {/* Track */}
            <circle cx={44} cy={44} r={ringR} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={3} />
            {/* Progress arc */}
            <circle
              cx={44} cy={44} r={ringR}
              fill="none"
              stroke={stability > 0.6 ? '#22c55e' : '#fff'}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringCircumference * (1 - stability)}
              style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s' }}
            />
          </svg>
          <button
            onClick={doCapture}
            aria-label="Capture"
            style={{
              width: 70, height: 70, borderRadius: '50%',
              background: '#fff', border: '3px solid rgba(255,255,255,0.35)',
              cursor: 'pointer', flexShrink: 0,
            }}
          />
        </div>

        {ready && stability < 0.08 && !cardInFrame && (
          <p style={{
            color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center',
            marginTop: -6, lineHeight: 1.4,
          }}>
            Fit the card inside the guide · auto-captures when steady
          </p>
        )}
      </div>

      {/* Hidden canvas used for frame extraction */}
      <canvas ref={capCanvas} style={{ display: 'none' }} />
    </div>
  );
}
