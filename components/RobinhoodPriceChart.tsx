'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  ComposedChart, Area, Line, ReferenceLine,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { CardPrediction } from '@/types';
import { getTeamLogoUrl } from '@/lib/team-logos';
import { ALL_TEAMS } from '@/lib/team-themes';

interface Props {
  prediction: CardPrediction;
  defaultView?: 'season' | 'game';
  priceMultiplier?: number;
  isLive?: boolean;
}

// Generates stable-ish seeded mock recent trades from the price range
function generateRecentTrades(basePrice: number, playerId: number) {
  const tiers = [
    { label: 'Raw RC',  mult: 1.0  },
    { label: 'PSA 8',  mult: 2.0  },
    { label: 'PSA 9',  mult: 4.0  },
    { label: 'PSA 10', mult: 10.0 },
    { label: 'Raw RC',  mult: 1.0  },
    { label: 'PSA 9',  mult: 4.0  },
    { label: 'PSA 8',  mult: 2.0  },
    { label: 'PSA 10', mult: 10.0 },
  ];
  return tiers.map((t, i) => {
    // Deterministic noise seeded by playerId so it doesn't flicker on re-render
    const seed = ((playerId * 1301 + i * 7919) % 200) / 1000; // 0.000–0.199
    const price = basePrice * t.mult * (0.91 + seed);
    const minsAgo = ((playerId * (i + 1) * 997) % 28) + 1;
    return { label: t.label, price: parseFloat(price.toFixed(2)), minsAgo };
  });
}

// ─── Types ─────────────────────────────────────────────────────────────────

type EventType = 'spike' | 'dip';
type ViewMode = 'season' | 'game';

type SeasonPoint = {
  date: string;
  hist: number | null;
  proj: number | null;
  low95: number;
  wid95: number;
  low55: number;
  wid55: number;
  eventType?: EventType;
  eventLabel?: string;
  eventChangePct?: number;
  opponentTeamId?: number;
};

type GamePoint = {
  label: string;
  price: number | null;   // null for projection-only points
  proj: number | null;    // null for historical (except bridge)
  low95: number;
  wid95: number;
  low55: number;
  wid55: number;
  event?: string;
  eventUp?: boolean;
  changePct?: number;
};

// ─── Constants ─────────────────────────────────────────────────────────────

const CONE_95: Record<string, number> = { high: 0.07, medium: 0.13, low: 0.22 };
const CI_55_RATIO = 0.39;
const OPPONENT_POOL = [147, 111, 121, 133, 118, 110, 134, 144, 137, 143, 142, 141, 113, 138, 140, 112, 114, 116, 117, 120];

function buildEventLabel(change: number): string {
  const pct = (Math.abs(change) * 100).toFixed(1);
  if (change > 0.07) return `Strong game drove a ${pct}% card surge`;
  if (change > 0.04) return `Solid outing triggered a ${pct}% price gain`;
  if (change > 0)    return `Steady demand bump — up ${pct}%`;
  if (change < -0.07) return `Rough game sent cards down ${pct}%`;
  if (change < -0.04) return `Quiet performance cooled demand — off ${pct}%`;
  return `Light market correction — down ${pct}%`;
}

// ─── Game-view raw data builder ─────────────────────────────────────────────

type RawGamePoint = { label: string; price: number; event?: string; eventUp?: boolean; changePct?: number };

function buildRawGamePoints(prediction: CardPrediction, scaledBase?: number): RawGamePoint[] {
  const isPitcher = ['P', 'SP', 'RP', 'CP'].includes(prediction.position);
  const s = prediction.liveStats;
  const base = scaledBase ?? prediction.currentPrice;
  const points: RawGamePoint[] = [{ label: 'Pre', price: base }];
  let price = base;

  if (!isPitcher) {
    const ab  = Number(s.atBats     ?? 0);
    const h   = Number(s.hits       ?? 0);
    const hr  = Number(s.homeRuns   ?? 0);
    const rbi = Number(s.rbi        ?? 0);
    const bb  = Number(s.walks      ?? 0);

    type PA = { delta: number; label: string };
    const pas: PA[] = [];

    let rbiLeft = rbi;
    for (let i = 0; i < hr; i++) {
      const r = Math.min(i === hr - 1 ? rbiLeft : Math.ceil(rbiLeft / Math.max(hr - i, 1)), rbiLeft);
      rbiLeft -= r;
      pas.push({ delta: base * (0.12 + r * 0.035), label: r >= 2 ? `${r}-run HR!` : 'Solo HR!' });
    }
    for (let i = 0; i < Math.max(0, h - hr); i++) {
      const r = rbiLeft > 0 ? 1 : 0;
      rbiLeft -= r;
      pas.push({ delta: base * (r ? 0.025 : 0.012), label: r ? 'RBI hit' : 'Single' });
    }
    for (let i = 0; i < bb; i++) pas.push({ delta: base * 0.004, label: 'Walk' });
    for (let i = 0; i < Math.max(0, ab - h); i++) pas.push({ delta: -base * 0.009, label: 'Out' });

    pas.sort((a, b) => a.delta - b.delta);

    const slots = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
    for (let i = 0; i < Math.min(pas.length, slots.length); i++) {
      const { delta, label } = pas[i];
      price = Math.max(base * 0.5, price + delta);
      const notable = Math.abs(delta / base) >= 0.01;
      points.push({
        label: slots[i],
        price: parseFloat(price.toFixed(2)),
        ...(notable ? { event: label, eventUp: delta > 0, changePct: (delta / (price - delta)) * 100 } : {}),
      });
    }

  } else {
    const ip = parseFloat(String(s.inningsPitched ?? '0'));
    const k  = Number(s.pitchingStrikeOuts ?? 0);
    const er = Number(s.earnedRuns ?? 0);
    const bb = Number(s.walks ?? 0);
    const fullInnings = Math.max(1, Math.floor(ip));

    for (let i = 1; i <= fullInnings; i++) {
      const inningK  = Math.round(k / fullInnings);
      const hasER    = er > 0 && i === Math.round(fullInnings * 0.4);
      const hasBB    = bb > 0 && i === Math.round(fullInnings * 0.6);
      const delta    = inningK * base * 0.014 - (hasER ? er * base * 0.038 : 0) - (hasBB ? base * 0.005 : 0);
      price = Math.max(base * 0.5, price + delta);
      const notable  = Math.abs(delta / base) >= 0.01;
      const ordinals: Record<number, string> = { 1:'1st',2:'2nd',3:'3rd' };
      const lbl = ordinals[i] ?? `${i}th`;
      points.push({
        label: lbl,
        price: parseFloat(price.toFixed(2)),
        ...(notable ? {
          event: hasER ? `${er} ER` : `${inningK}K`,
          eventUp: delta > 0,
          changePct: (delta / (price - delta)) * 100,
        } : {}),
      });
    }
  }

  return points;
}

// ─── SVG Dots ───────────────────────────────────────────────────────────────

// Season view: clean small dot — logo + matchup appear in hover tooltip
function SeasonDot({ cx, cy, payload }: {
  cx?: number; cy?: number; payload?: SeasonPoint;
}) {
  if (!payload?.eventType || cx == null || cy == null) return <g />;
  const up = payload.eventType === 'spike';
  const color = up ? '#22c55e' : '#ef4444';
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill={color} fillOpacity={0.15} />
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="#0d1526" strokeWidth={1.5} />
      <text x={cx} y={cy - 11} textAnchor="middle" fontSize={8} fill={color} fontWeight="bold">
        {up ? '▲' : '▼'}
      </text>
    </g>
  );
}

// Game view: colored event dot
function GameDot({ cx, cy, payload, onDotClick }: {
  cx?: number; cy?: number; payload?: GamePoint;
  onDotClick: (pt: GamePoint) => void;
}) {
  if (!payload?.event || cx == null || cy == null) return <g />;
  const up = payload.eventUp !== false;
  const color = up ? '#22c55e' : '#ef4444';
  return (
    <g style={{ cursor: 'pointer' }} onClick={() => onDotClick(payload)}>
      <circle cx={cx} cy={cy} r={9} fill={color} fillOpacity={0.18} />
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="#0d1526" strokeWidth={1.5} />
      <text x={cx} y={cy - 11} textAnchor="middle" fontSize={8} fill={color} fontWeight="bold">
        {up ? '▲' : '▼'}
      </text>
    </g>
  );
}

// ─── StatPill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, highlight, color }: {
  label: string; value: number | string; highlight?: boolean; color?: string;
}) {
  return (
    <div
      className="rounded-lg p-2 text-center"
      style={{ backgroundColor: highlight ? `${color}18` : '#ffffff08' }}
    >
      <p className="font-bold text-sm" style={{ color: highlight && color ? color : '#fff' }}>
        {value}
      </p>
      <p className="text-gray-500 text-xs">{label}</p>
    </div>
  );
}

// ─── CI tooltip rows (shared) ────────────────────────────────────────────────

function CIRows({ low55, wid55, low95, wid95, lineColor }: {
  low55: number; wid55: number; low95: number; wid95: number; lineColor: string;
}) {
  return (
    <div className="px-3 pb-2 pt-1.5 border-t border-white/10 space-y-1">
      {[
        { label: '55% CI', lo: low55, hi: low55 + wid55, op: 0.55 },
        { label: '95% CI', lo: low95, hi: low95 + wid95, op: 0.20 },
      ].map(ci => (
        <div key={ci.label} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: lineColor, opacity: ci.op }} />
            <span className="text-gray-500 text-[10px]">{ci.label}</span>
          </div>
          <span className="text-gray-300 text-[10px] font-medium tabular-nums">
            ${ci.lo.toFixed(0)}–${ci.hi.toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function RobinhoodPriceChart({ prediction, defaultView, priceMultiplier = 1, isLive }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView ?? 'season');
  const [activeGameEvent, setActiveGameEvent] = useState<GamePoint | null>(null);

  const isUp = prediction.direction === 'up';
  const lineColor = isUp ? '#22c55e' : '#ef4444';
  const half95 = CONE_95[prediction.confidence] ?? 0.13;
  const half55 = half95 * CI_55_RATIO;
  const teamLogoUrl = getTeamLogoUrl(prediction.teamId);

  const scaledCurrentPrice = prediction.currentPrice * priceMultiplier;
  const scaledProjectedPrice = prediction.projectedPrice * priceMultiplier;

  // ── Season data ──────────────────────────────────────────────────────────

  const { seasonData, nowDate } = useMemo(() => {
    const rawHistory = prediction.priceSummary?.priceHistory ?? [];
    const history = rawHistory.map(h => ({ ...h, price: h.price * priceMultiplier }));
    const lastPrice = history.at(-1)?.price ?? scaledCurrentPrice;
    const target = scaledProjectedPrice;
    const nowDate = rawHistory.at(-1)?.date ?? new Date().toISOString().split('T')[0];

    const movements = history
      .map((h, i) => ({ i, change: i > 0 ? (h.price - history[i-1].price) / history[i-1].price : 0 }))
      .filter(m => Math.abs(m.change) >= 0.025);

    const eventIdxs = new Set([
      ...movements.filter(m => m.change > 0).sort((a,b) => b.change - a.change).slice(0,2).map(m=>m.i),
      ...movements.filter(m => m.change < 0).sort((a,b) => a.change - b.change).slice(0,2).map(m=>m.i),
    ]);
    const changeMap = new Map(movements.map(m => [m.i, m.change]));
    const oppPool = OPPONENT_POOL.filter(id => id !== prediction.teamId);
    const eventIdxArray = [...eventIdxs].sort((a,b) => a - b);
    const oppMap = new Map(eventIdxArray.map((idx, n) => [idx, oppPool[n % oppPool.length]]));

    const historicalPoints: SeasonPoint[] = history.map((h, i) => {
      const change = changeMap.get(i) ?? 0;
      const isEvent = eventIdxs.has(i);
      return {
        date: h.date, hist: h.price, proj: null,
        low95: h.price, wid95: 0, low55: h.price, wid55: 0,
        ...(isEvent ? {
          eventType: (change > 0 ? 'spike' : 'dip') as EventType,
          eventLabel: buildEventLabel(change),
          eventChangePct: change * 100,
          opponentTeamId: oppMap.get(i),
        } : {}),
      };
    });

    if (historicalPoints.length > 0) historicalPoints[historicalPoints.length - 1].proj = lastPrice;

    const projPoints: SeasonPoint[] = Array.from({ length: 14 }, (_, i) => {
      const t = (i+1)/14;
      const proj = lastPrice + (target - lastPrice) * t;
      const h95 = proj * half95 * t, h55 = proj * half55 * t;
      const d = new Date(nowDate + 'T12:00:00'); d.setDate(d.getDate() + i + 1);
      return {
        date: d.toISOString().split('T')[0], hist: null, proj,
        low95: Math.max(0, proj - h95), wid95: h95*2,
        low55: Math.max(0, proj - h55), wid55: h55*2,
      };
    });

    return { seasonData: [...historicalPoints, ...projPoints], nowDate };
  }, [prediction, half95, half55, scaledCurrentPrice, scaledProjectedPrice, priceMultiplier]);

  // ── Game data (historical + post-game projection cone) ───────────────────

  const { gameData, lastInningLabel } = useMemo(() => {
    const raw = buildRawGamePoints(prediction, scaledCurrentPrice);
    const finalPrice = raw.at(-1)?.price ?? scaledCurrentPrice;
    const target = scaledProjectedPrice;
    const lastInningLabel = raw.at(-1)?.label ?? 'End';

    // Historical points: zero-width CI bands so the cone only appears in projection
    const historical: GamePoint[] = raw.map((p, i) => ({
      label: p.label,
      price: p.price,
      proj: i === raw.length - 1 ? p.price : null, // bridge: last historical links to proj line
      low95: p.price, wid95: 0,
      low55: p.price, wid55: 0,
      ...(p.event ? { event: p.event, eventUp: p.eventUp, changePct: p.changePct } : {}),
    }));

    // Post-game projection with expanding CI cone
    const projLabels = ['+1D', '+3D', '+1W', '+2W'];
    const projPoints: GamePoint[] = projLabels.map((label, i) => {
      const t = (i + 1) / projLabels.length;
      const proj = finalPrice + (target - finalPrice) * t;
      const h95 = proj * half95 * t;
      const h55 = proj * half55 * t;
      return {
        label, price: null, proj,
        low95: Math.max(0, proj - h95), wid95: h95 * 2,
        low55: Math.max(0, proj - h55), wid55: h55 * 2,
      };
    });

    return { gameData: [...historical, ...projPoints], lastInningLabel };
  }, [prediction, half95, half55, scaledCurrentPrice, scaledProjectedPrice]);

  // ── Y domains ─────────────────────────────────────────────────────────────

  const seasonYMin = useMemo(() => {
    const vals = seasonData.flatMap(d => [d.low95, d.low95 + d.wid95, d.hist, d.proj].filter(v => v != null) as number[]);
    return Math.max(0, Math.min(...vals) * 0.93);
  }, [seasonData]);
  const seasonYMax = useMemo(() => {
    const vals = seasonData.flatMap(d => [d.low95 + d.wid95, d.hist, d.proj].filter(v => v != null) as number[]);
    return Math.max(...vals) * 1.07;
  }, [seasonData]);

  const gameYMin = useMemo(() => {
    const vals = gameData.flatMap(d => [d.low95, d.price, d.proj].filter(v => v != null) as number[]);
    return Math.max(0, Math.min(...vals) * 0.96);
  }, [gameData]);
  const gameYMax = useMemo(() => {
    const vals = gameData.flatMap(d => [d.low95 + d.wid95, d.price, d.proj].filter(v => v != null) as number[]);
    return Math.max(...vals) * 1.04;
  }, [gameData]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGameDot = useCallback((pt: GamePoint) => {
    setActiveGameEvent(prev => prev?.label === pt.label ? null : pt);
  }, []);

  const fmtDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' });

  const lastGameLabel = prediction.priceSummary?.priceHistory?.at(-1)?.date
    ? fmtDate(prediction.priceSummary.priceHistory.at(-1)!.date)
    : 'Last Game';

  // ─────────────────────────────────────────────────────────────────────────

  const recentTrades = generateRecentTrades(scaledCurrentPrice, prediction.playerId);

  return (
    <div>
      <style>{`
        @keyframes scroll-tape {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .tape-track { animation: scroll-tape 28s linear infinite; }
        .tape-track:hover { animation-play-state: paused; }
      `}</style>

      {/* Recent trades ticker tape */}
      <div className="overflow-hidden rounded-lg mb-3" style={{ backgroundColor: '#ffffff06' }}>
        <div className="flex tape-track" style={{ width: 'max-content' }}>
          {[...recentTrades, ...recentTrades].map((t, i) => (
            <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 flex-shrink-0">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: t.label === 'PSA 10' ? '#f59e0b' : t.label === 'PSA 9' ? '#22c55e' : t.label === 'PSA 8' ? '#3b82f6' : '#6b7280' }}
              />
              <span className="text-[10px] font-semibold text-gray-400 whitespace-nowrap">{t.label}</span>
              <span className="text-[10px] font-bold text-white whitespace-nowrap tabular-nums">${t.price.toFixed(2)}</span>
              <span className="text-[10px] text-gray-600 whitespace-nowrap">{t.minsAgo}m ago</span>
              <span className="text-gray-700 text-[10px] mx-1">·</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section header + view toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Price History &amp; Forecast
          </p>
          {isLive && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#22c55e18' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[9px] font-bold text-green-400 tracking-wider">LIVE</span>
            </div>
          )}
        </div>
        <div className="flex rounded-lg overflow-hidden border border-white/10" style={{ fontSize: 10 }}>
          <button
            onClick={() => setViewMode('season')}
            className="px-2.5 py-1 font-semibold transition-colors"
            style={{
              backgroundColor: viewMode === 'season' ? lineColor : 'transparent',
              color: viewMode === 'season' ? '#fff' : '#6b7280',
            }}
          >
            📈 Season
          </button>
          <button
            onClick={() => setViewMode('game')}
            className="px-2.5 py-1 font-semibold flex items-center gap-1 transition-colors"
            style={{
              backgroundColor: viewMode === 'game' ? lineColor : 'transparent',
              color: viewMode === 'game' ? '#fff' : '#6b7280',
            }}
          >
            ⚡ Live / Last Game
          </button>
        </div>
      </div>

      {/* ── SEASON VIEW ──────────────────────────────────────────────────────── */}
      {viewMode === 'season' && (
        <>
          <div style={{ height: 175 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={seasonData} margin={{ top: 14, right: 44, bottom: 2, left: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4b5563' }} tickLine={false} axisLine={false}
                  tickFormatter={fmtDate} interval={Math.floor(seasonData.length / 5)} height={20} />
                <YAxis domain={[seasonYMin, seasonYMax]} allowDataOverflow orientation="right"
                  tickCount={4} width={42} tick={{ fontSize: 9, fill: '#374151' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `$${v < 10 ? v.toFixed(2) : v.toFixed(0)}`} />
                <ReferenceLine x={nowDate} stroke="#ffffff18" strokeDasharray="3 4" strokeWidth={1}
                  label={{ value: 'NOW', position: 'insideTopLeft', fontSize: 8, fill: '#4b5563', dy: -2 }} />
                <Area dataKey="low95" stackId="b95" stroke="none" fill="transparent" fillOpacity={0} isAnimationActive={false} dot={false} />
                <Area dataKey="wid95" stackId="b95" stroke="none" fill={lineColor} fillOpacity={0.14} isAnimationActive={false} dot={false} />
                <Area dataKey="low55" stackId="b55" stroke="none" fill="transparent" fillOpacity={0} isAnimationActive={false} dot={false} />
                <Area dataKey="wid55" stackId="b55" stroke="none" fill={lineColor} fillOpacity={0.24} isAnimationActive={false} dot={false} />
                <Area dataKey="hist" stroke={lineColor} strokeWidth={2.5} fill="transparent" fillOpacity={0}
                  connectNulls={false} animationDuration={800} animationEasing="ease-out"
                  activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
                  dot={(dp: Record<string, unknown>) => (
                    <SeasonDot key={`sd-${dp.index as number}`} cx={dp.cx as number} cy={dp.cy as number}
                      payload={dp.payload as SeasonPoint} />
                  )} />
                <Line dataKey="proj" stroke={lineColor} strokeWidth={2} strokeDasharray="5 3" strokeOpacity={0.75}
                  dot={false} activeDot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
                  connectNulls={false} animationDuration={1100} animationEasing="ease-out" />
                <Tooltip cursor={{ stroke: '#ffffff18', strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const pt = payload[0]?.payload as SeasonPoint;
                    const price = pt?.hist ?? pt?.proj;
                    if (price == null) return null;
                    const isProj = pt.hist == null && pt.wid95 > 0;
                    const isEvent = !!pt.eventType;
                    const oppTeam = pt.opponentTeamId ? ALL_TEAMS.find(t => t.id === pt.opponentTeamId) : null;
                    const oppLogoUrl = pt.opponentTeamId ? getTeamLogoUrl(pt.opponentTeamId) : null;
                    const up = pt.eventType === 'spike';
                    const eventColor = up ? '#22c55e' : '#ef4444';
                    return (
                      <div className="rounded-xl border border-white/10 shadow-xl overflow-hidden" style={{ backgroundColor: '#0d1526', minWidth: 160 }}>
                        {/* Header: own team logo + price + date */}
                        <div className="flex items-center gap-2.5 px-3 py-2">
                          {teamLogoUrl && <img src={teamLogoUrl} alt="" width={24} height={24} className="object-contain opacity-90 flex-shrink-0" />}
                          <div>
                            <p className="text-white text-xs font-bold leading-snug">${price.toFixed(2)}</p>
                            <p className="text-gray-500 text-[10px] leading-snug">{fmtDate(pt.date)}</p>
                          </div>
                        </div>
                        {/* Event row: opponent logo + matchup label + % change */}
                        {isEvent && oppTeam && oppLogoUrl && (
                          <div className="flex items-center gap-2.5 px-3 py-2 border-t border-white/10"
                            style={{ backgroundColor: up ? '#22c55e0a' : '#ef44440a' }}>
                            <img src={oppLogoUrl} alt="" width={22} height={22} className="object-contain opacity-90 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-400 text-[10px] leading-snug">vs {oppTeam.name}</p>
                              <p className="text-[10px] font-semibold leading-snug" style={{ color: eventColor }}>
                                {(pt.eventChangePct ?? 0) > 0 ? '+' : ''}{pt.eventChangePct?.toFixed(1)}% · {pt.eventLabel?.split('—')[0].trim()}
                              </p>
                            </div>
                          </div>
                        )}
                        {/* CI ranges for projected points */}
                        {isProj && (
                          <CIRows low55={pt.low55} wid55={pt.wid55} low95={pt.low95} wid95={pt.wid95} lineColor={lineColor} />
                        )}
                      </div>
                    );
                  }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Season legend */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {[
              { icon: <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={lineColor} strokeWidth="2.5"/></svg>, label: 'Historical' },
              { icon: <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={lineColor} strokeWidth="2" strokeDasharray="4 3" strokeOpacity="0.75"/></svg>, label: 'Projected' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-1.5">{icon}<span className="text-gray-600 text-[10px]">{label}</span></div>
            ))}
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: lineColor, opacity: 0.38 }}/><span className="text-gray-600 text-[10px]">55% CI</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: lineColor, opacity: 0.16 }}/><span className="text-gray-600 text-[10px]">95% CI</span></div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: '#0d1526', borderColor: lineColor }}/>
              <span className="text-gray-600 text-[10px]">Tap to see matchup</span>
            </div>
          </div>

          {/* Season contextual stats: why this card is moving */}
          {prediction.reasons.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Why this card is moving</p>
              <div className="space-y-1.5">
                {prediction.reasons.map((reason, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: lineColor }} />
                    <p className="text-gray-300 text-xs leading-5">{reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── GAME VIEW ────────────────────────────────────────────────────────── */}
      {viewMode === 'game' && (
        <>
          {/* Live / Last Game badge */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#ffffff0a' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block" />
              <span className="text-gray-500 text-[10px] font-semibold">Last Game · {lastGameLabel}</span>
            </div>
            <span className="text-gray-600 text-[10px]">Tap events to expand</span>
          </div>

          <div style={{ height: 175 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={gameData} margin={{ top: 16, right: 44, bottom: 2, left: 0 }}>
                <defs>
                  <linearGradient id={`game-grad-${prediction.playerId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.30} />
                    <stop offset="90%" stopColor={lineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#4b5563' }} tickLine={false} axisLine={false} height={20} interval={0} />
                <YAxis domain={[gameYMin, gameYMax]} allowDataOverflow orientation="right"
                  tickCount={4} width={42} tick={{ fontSize: 9, fill: '#374151' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `$${v < 10 ? v.toFixed(2) : v.toFixed(0)}`} />
                {/* Divider between game and projection */}
                <ReferenceLine x={lastInningLabel} stroke="#ffffff18" strokeDasharray="3 4" strokeWidth={1}
                  label={{ value: 'END', position: 'insideTopLeft', fontSize: 8, fill: '#4b5563', dy: -2 }} />
                {/* CI bands — zero-width on historical, expanding cone on projection */}
                <Area dataKey="low95" stackId="g95" stroke="none" fill="transparent" fillOpacity={0} isAnimationActive={false} dot={false} />
                <Area dataKey="wid95" stackId="g95" stroke="none" fill={lineColor} fillOpacity={0.14} isAnimationActive={false} dot={false} />
                <Area dataKey="low55" stackId="g55" stroke="none" fill="transparent" fillOpacity={0} isAnimationActive={false} dot={false} />
                <Area dataKey="wid55" stackId="g55" stroke="none" fill={lineColor} fillOpacity={0.24} isAnimationActive={false} dot={false} />
                {/* Historical game area with gradient fill */}
                <Area dataKey="price" stroke={lineColor} strokeWidth={2.5}
                  fill={`url(#game-grad-${prediction.playerId})`} fillOpacity={1}
                  connectNulls={false} animationDuration={700} animationEasing="ease-out"
                  activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
                  dot={(dp: Record<string, unknown>) => (
                    <GameDot key={`gd-${dp.index as number}`} cx={dp.cx as number} cy={dp.cy as number}
                      payload={dp.payload as GamePoint} onDotClick={handleGameDot} />
                  )} />
                {/* Post-game projected dashed line */}
                <Line dataKey="proj" stroke={lineColor} strokeWidth={2} strokeDasharray="5 3" strokeOpacity={0.75}
                  dot={false} activeDot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
                  connectNulls={false} animationDuration={1100} animationEasing="ease-out" />
                <Tooltip cursor={{ stroke: '#ffffff18', strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const pt = payload[0]?.payload as GamePoint;
                    const price = pt?.price ?? pt?.proj;
                    if (price == null) return null;
                    const isProj = pt.price == null && pt.wid95 > 0;
                    return (
                      <div className="rounded-xl border border-white/10 shadow-xl overflow-hidden" style={{ backgroundColor: '#0d1526', minWidth: 160 }}>
                        <div className="flex items-center gap-2.5 px-3 py-2">
                          {teamLogoUrl && <img src={teamLogoUrl} alt="" width={22} height={22} className="object-contain opacity-90 flex-shrink-0" />}
                          <div>
                            <p className="text-white text-xs font-bold leading-snug">${price.toFixed(2)}</p>
                            <p className="text-gray-500 text-[10px] leading-snug">{pt.label}</p>
                            {pt.event && (
                              <p className="text-[10px] leading-snug font-semibold" style={{ color: pt.eventUp ? '#22c55e' : '#ef4444' }}>
                                {pt.event}
                              </p>
                            )}
                          </div>
                        </div>
                        {isProj && (
                          <CIRows low55={pt.low55} wid55={pt.wid55} low95={pt.low95} wid95={pt.wid95} lineColor={lineColor} />
                        )}
                      </div>
                    );
                  }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Game event detail card (tap on a play dot to expand) */}
          {activeGameEvent && (
            <div className="mt-2 rounded-xl p-3 border"
              style={{
                backgroundColor: activeGameEvent.eventUp ? '#22c55e0d' : '#ef44440d',
                borderColor: activeGameEvent.eventUp ? '#22c55e30' : '#ef444430',
              }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="text-sm leading-none mt-0.5">{activeGameEvent.eventUp ? '📈' : '📉'}</span>
                  <div>
                    <p className="text-white text-xs font-semibold leading-snug">{activeGameEvent.event}</p>
                    <p className="text-gray-500 text-[10px] mt-0.5">{activeGameEvent.label} inning · ${activeGameEvent.price?.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-xs font-bold" style={{ color: activeGameEvent.eventUp ? '#22c55e' : '#ef4444' }}>
                    {(activeGameEvent.changePct ?? 0) > 0 ? '+' : ''}{activeGameEvent.changePct?.toFixed(1)}%
                  </span>
                  <button onClick={() => setActiveGameEvent(null)} className="text-gray-600 text-[10px] hover:text-gray-400 transition-colors">dismiss</button>
                </div>
              </div>
            </div>
          )}

          {/* Game legend */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={lineColor} strokeWidth="2.5"/></svg>
              <span className="text-gray-600 text-[10px]">Card value</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={lineColor} strokeWidth="2" strokeDasharray="4 3" strokeOpacity="0.75"/></svg>
              <span className="text-gray-600 text-[10px]">Projected</span>
            </div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: lineColor, opacity: 0.38 }}/><span className="text-gray-600 text-[10px]">55% CI</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: lineColor, opacity: 0.16 }}/><span className="text-gray-600 text-[10px]">95% CI</span></div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#22c55e' }} />
              <span className="text-gray-600 text-[10px]">Positive play</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#ef4444' }} />
              <span className="text-gray-600 text-[10px]">Negative play</span>
            </div>
          </div>

          {/* Game contextual stats: today's performance */}
          {(() => {
            const s = prediction.liveStats;
            const isPitcher = ['P', 'SP', 'RP', 'CP'].includes(prediction.position);
            return (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {isPitcher ? 'Pitching Line' : "Today's Performance"}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {!isPitcher ? (
                    <>
                      <StatPill label="AB"  value={s.atBats      ?? '—'} />
                      <StatPill label="H"   value={s.hits        ?? '—'} />
                      <StatPill label="HR"  value={s.homeRuns    ?? '—'} highlight={!!s.homeRuns}  color={lineColor} />
                      <StatPill label="RBI" value={s.rbi         ?? '—'} highlight={!!(s.rbi && s.rbi >= 3)} color={lineColor} />
                      <StatPill label="BB"  value={s.walks       ?? '—'} />
                      <StatPill label="K"   value={s.strikeOuts  ?? '—'} />
                      <StatPill label="AVG" value={s.avg         ?? '—'} />
                    </>
                  ) : (
                    <>
                      <StatPill label="IP" value={s.inningsPitched     ?? '—'} highlight={parseFloat(String(s.inningsPitched ?? '0')) >= 6} color={lineColor} />
                      <StatPill label="K"  value={s.pitchingStrikeOuts ?? '—'} highlight={!!(s.pitchingStrikeOuts && s.pitchingStrikeOuts >= 8)} color={lineColor} />
                      <StatPill label="ER" value={s.earnedRuns         ?? '—'} />
                      <StatPill label="BB" value={s.walks              ?? '—'} />
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
