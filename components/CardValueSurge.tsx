'use client';

import { useEffect, useRef, useState } from 'react';
import { PlayEventType, getEventTier, isPositiveEvent } from '@/lib/play-detector';

const SURGE_TARGETS: Record<string, number> = {
  single:      2,
  double:      3,
  stolen_base: 2,
  triple:      5,
  home_run:    13,
  grand_slam:  20,
  cycle:       28,
  strikeout:   -3,
  groundout:   -1.5,
  flyout:      -1.5,
  double_play: -5,
};

const SURGE_LABELS: Record<string, string> = {
  single:      'Base hit — collectors paying attention',
  double:      'Extra-base hit — buying interest up',
  stolen_base: 'Speed play — light collector buzz',
  triple:      'Triple — collectors moving fast',
  home_run:    'Home run spike — demand surging',
  grand_slam:  'Grand slam — market going wild',
  cycle:       'Cycle achieved — historic premium',
  strikeout:   'Strikeout — demand softening',
  groundout:   'Out recorded — minor price pressure',
  flyout:      'Out recorded — minor price pressure',
  double_play: 'Double play — market pulling back',
};

const WINDOW_LABELS: Record<string, string> = {
  minor:   '~1 hr window',
  notable: '~2 hr window',
  major:   '~4 hr window',
  epic:    '~6–12 hr window',
};

type ActivityFn = (viewers: number, bids: number) => string;

const POSITIVE_ACTIVITY: ActivityFn[] = [
  (n) => `⚡ ${n.toLocaleString()} collectors watching`,
  () => `💳 Purchase placed • just now`,
  (_, b) => `📊 ${b} bids placed in last 60s`,
  () => `🔥 ${Math.floor(Math.random() * 8 + 9)}× above normal activity`,
  () => `📈 New high offer placed`,
  () => `👁 Price updated • 2s ago`,
  () => `💰 Offer accepted • 5s ago`,
];

const NEGATIVE_ACTIVITY: ActivityFn[] = [
  (n) => `👁 ${n.toLocaleString()} holders monitoring`,
  () => `📉 Sell order placed • just now`,
  () => `⚠️ Demand softening temporarily`,
  () => `💸 Sellers entering the market`,
  () => `📊 Buy interest paused`,
  () => `⏳ Market stabilizing`,
];

interface Props {
  eventType: PlayEventType;
  color: string;
}

export default function CardValueSurge({ eventType, color }: Props) {
  const target = SURGE_TARGETS[eventType] ?? 8;
  const tier = getEventTier(eventType);
  const positive = isPositiveEvent(eventType);
  const absTarget = Math.abs(target);

  const [pct, setPct] = useState(0);
  const [jitter, setJitter] = useState(0);
  const [phase, setPhase] = useState<'surging' | 'peaked'>('surging');
  const [activityIdx, setActivityIdx] = useState(0);
  const [viewerCount, setViewerCount] = useState(() => Math.floor(Math.random() * 1200 + 800));
  const [bidCount, setBidCount] = useState(() => Math.floor(Math.random() * 20 + 8));

  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  // Animate 0 → absTarget over 6s with cubic ease-out
  useEffect(() => {
    const duration = 6000;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(elapsed / duration, 1);
      setPct(parseFloat((ease(t) * absTarget).toFixed(1)));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPhase('peaked');
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [absTarget]);

  // Price jitter: ±0.3% noise while surging to feel like live market data
  useEffect(() => {
    if (phase !== 'surging') { setJitter(0); return; }
    const id = setInterval(() => {
      setJitter(parseFloat(((Math.random() - 0.5) * 0.6).toFixed(1)));
    }, 380);
    return () => clearInterval(id);
  }, [phase]);

  // Rotate activity messages every 1.8s
  useEffect(() => {
    const msgs = positive ? POSITIVE_ACTIVITY : NEGATIVE_ACTIVITY;
    const id = setInterval(() => setActivityIdx(i => (i + 1) % msgs.length), 1800);
    return () => clearInterval(id);
  }, [positive]);

  // Viewer count ticks up slowly while surging
  useEffect(() => {
    if (phase !== 'surging') return;
    const id = setInterval(() => {
      setViewerCount(n => n + Math.floor(Math.random() * 5 + 1));
    }, 2200);
    return () => clearInterval(id);
  }, [phase]);

  // Bid counter increments (positive events only)
  useEffect(() => {
    if (phase !== 'surging' || !positive) return;
    const id = setInterval(() => setBidCount(n => n + 1), 3500);
    return () => clearInterval(id);
  }, [phase, positive]);

  const displayPct = Math.max(0, pct + (phase === 'surging' ? jitter : 0));
  const barPct = Math.min((pct / absTarget) * 100, 100);
  const msgs = positive ? POSITIVE_ACTIVITY : NEGATIVE_ACTIVITY;
  const activityText = msgs[activityIdx % msgs.length](viewerCount, bidCount);

  const sign = positive ? '+' : '−';
  const surgeLabel = positive
    ? (phase === 'surging' ? 'LIVE SURGE' : 'SURGE PEAKED')
    : (phase === 'surging' ? 'MARKET DIP' : 'DIP LEVELING');
  const climbLabel = positive
    ? (phase === 'surging' ? 'and climbing' : '— buy window open')
    : (phase === 'surging' ? 'and falling' : '— stabilizing');

  return (
    <div
      className="rounded-2xl p-4 mb-4"
      style={{ backgroundColor: `${color}14`, border: `1px solid ${color}30` }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: color,
              boxShadow: `0 0 6px ${color}`,
              animation: phase === 'surging' ? 'pulse 1s ease-in-out infinite' : 'none',
            }}
          />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
            {surgeLabel}
          </span>
        </div>
        <span className="text-xs text-gray-500">{WINDOW_LABELS[tier]}</span>
      </div>

      {/* Big percentage */}
      <div className="flex items-baseline gap-1 mb-2">
        <span
          className="font-black tabular-nums leading-none"
          style={{ fontSize: '2rem', color, lineHeight: 1 }}
        >
          {sign}{displayPct.toFixed(1)}%
        </span>
        <span className="text-gray-400 text-sm font-semibold">
          {climbLabel}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 rounded-full overflow-hidden mb-2" style={{ backgroundColor: '#ffffff12' }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${barPct}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            transition: 'width 0.1s linear',
            boxShadow: `0 0 8px ${color}80`,
          }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: phase === 'surging' ? 'shimmer 1.2s linear infinite' : 'none',
          }}
        />
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">{SURGE_LABELS[eventType] ?? 'Market reacting'}</span>
        <span className="text-xs font-bold" style={{ color }}>target {sign}{absTarget}%</span>
      </div>

      {/* Live activity ticker */}
      <div
        className="rounded-xl px-3 py-2"
        style={{ backgroundColor: '#ffffff08', borderLeft: `2px solid ${color}55` }}
      >
        <p
          key={activityIdx}
          className="text-xs font-medium"
          style={{ color: '#d1d5db', animation: 'ticker-in 0.35s ease' }}
        >
          {activityText}
        </p>
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes ticker-in {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
