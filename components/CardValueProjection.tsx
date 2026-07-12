'use client';

import { CardValueProjection, ProjectionFactor, ProjectionCategory } from '@/types';
import { TrendingUp, TrendingDown, Minus, Zap, BarChart2, Star, ShieldAlert, Activity, BookOpen } from 'lucide-react';
import { useTeam } from '@/context/TeamContext';
import { useState } from 'react';

interface Props {
  projection: CardValueProjection;
  priceMultiplier?: number;
  actualBinPrice?: number | null;
  factorsOnly?: boolean;
}

function categoryIcon(cat: ProjectionCategory) {
  switch (cat) {
    case 'live_event':       return <Zap size={11} />;
    case 'game_performance': return <Activity size={11} />;
    case 'season_arc':       return <BarChart2 size={11} />;
    case 'milestone':        return <Star size={11} />;
    case 'market':           return <TrendingUp size={11} />;
    case 'negative':         return <ShieldAlert size={11} />;
  }
}

function categoryLabel(cat: ProjectionCategory): string {
  switch (cat) {
    case 'live_event':       return 'Live Event';
    case 'game_performance': return 'Game Performance';
    case 'season_arc':       return 'Season Arc';
    case 'milestone':        return 'Milestone';
    case 'market':           return 'Market Signal';
    case 'negative':         return 'Risk Factor';
  }
}

function categoryColor(cat: ProjectionCategory): string {
  switch (cat) {
    case 'live_event':       return '#f59e0b';
    case 'game_performance': return '#22c55e';
    case 'season_arc':       return '#3b82f6';
    case 'milestone':        return '#a855f7';
    case 'market':           return '#06b6d4';
    case 'negative':         return '#ef4444';
  }
}

function MiniProjectionChart({
  currentPrice,
  projectedPrice,
  pctChange,
  confidence,
  color,
}: {
  currentPrice: number;
  projectedPrice: number;
  pctChange: number;
  confidence: 'high' | 'medium' | 'low';
  color: string;
}) {
  const W = 300;
  const H = 72;
  const xL = 0;
  const xR = W;
  const isUp = pctChange >= 0;

  // Y positions: current at vertical midpoint, projected offset by magnitude
  const mid = H / 2;
  const maxShift = H * 0.36;
  const shift = Math.min(Math.abs(pctChange) / 15, 1) * maxShift;
  const yL = mid;
  const yR = isUp ? mid - shift : mid + shift;

  // Smooth S-curve via cubic bezier
  const cp1x = W * 0.45; const cp2x = W * 0.55;
  const linePath = `M ${xL} ${yL} C ${cp1x} ${yL}, ${cp2x} ${yR}, ${xR} ${yR}`;

  // Confidence cone width (px at right end)
  const coneHalf = confidence === 'high' ? H * 0.06 : confidence === 'medium' ? H * 0.14 : H * 0.24;
  const conePath = [
    `M ${xL} ${yL}`,
    `C ${cp1x} ${yL}, ${cp2x} ${yR - coneHalf}, ${xR} ${yR - coneHalf}`,
    `L ${xR} ${yR + coneHalf}`,
    `C ${cp2x} ${yR + coneHalf}, ${cp1x} ${yL}, ${xL} ${yL}`,
    'Z',
  ].join(' ');

  // Unique animation id per render so it replays on card change
  const animId = `proj-${Math.round(currentPrice * 100)}-${Math.round(projectedPrice * 100)}`;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <style>{`
        @keyframes draw-${animId} {
          from { stroke-dashoffset: 400; opacity: 0; }
          10%  { opacity: 1; }
          to   { stroke-dashoffset: 0; opacity: 1; }
        }
        .line-${animId} {
          stroke-dasharray: 400;
          stroke-dashoffset: 400;
          animation: draw-${animId} 1.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}>
        {/* Confidence cone */}
        <path d={conePath} fill={color} fillOpacity={0.10} />

        {/* Animated projection line */}
        <path
          d={linePath}
          stroke={color}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          className={`line-${animId}`}
        />

        {/* Start dot */}
        <circle cx={xL} cy={yL} r={4} fill={color} fillOpacity={0.5} />

        {/* End dot */}
        <circle cx={xR} cy={yR} r={4} fill={color} />
      </svg>

      {/* Price labels — positioned over the SVG */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: H, pointerEvents: 'none' }}>
        {/* Current price — anchored to left dot */}
        <div style={{ position: 'absolute', left: 4, top: yL / H * 100 + '%', transform: 'translateY(-120%)' }}>
          <span style={{ color: '#9ca3af', fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            ${currentPrice.toFixed(2)}
          </span>
        </div>
        {/* Projected price — anchored to right dot */}
        <div style={{ position: 'absolute', right: 4, top: yR / H * 100 + '%', transform: 'translateY(-120%)', textAlign: 'right' }}>
          <span style={{ color, fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            ${projectedPrice.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Time labels */}
      <div className="flex justify-between px-0.5" style={{ marginTop: 2 }}>
        <span className="text-[9px] text-gray-700">Now</span>
        <span className="text-[9px] text-gray-700">+24h</span>
      </div>
    </div>
  );
}

function FactorRow({ factor }: { factor: ProjectionFactor }) {
  const [showBasis, setShowBasis] = useState(false);
  const isNeg = factor.impact < 0;
  const color = isNeg ? '#ef4444' : '#22c55e';
  const catColor = categoryColor(factor.category);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {/* Category badge */}
        <div
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex-shrink-0"
          style={{ backgroundColor: `${catColor}18`, color: catColor }}
        >
          {categoryIcon(factor.category)}
          <span>{categoryLabel(factor.category)}</span>
        </div>

        {/* Factor label */}
        <span className="text-slate-900 text-xs font-medium flex-1 truncate">{factor.label}</span>

        {/* Impact */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isNeg ? <TrendingDown size={11} color={color} /> : <TrendingUp size={11} color={color} />}
          <span className="text-xs font-bold tabular-nums" style={{ color }}>
            {isNeg ? '' : '+'}{factor.impact}%
          </span>
        </div>

        {/* Expand for historical basis */}
        <button
          onClick={() => setShowBasis(b => !b)}
          className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0"
          aria-label="Historical basis"
        >
          <BookOpen size={11} />
        </button>
      </div>

      {showBasis && (
        <div
          className="ml-2 pl-2 border-l text-[10px] text-slate-500 leading-relaxed"
          style={{ borderColor: catColor + '40' }}
        >
          {factor.historicalBasis}
        </div>
      )}
    </div>
  );
}

function FactorsPanel({ projection }: { projection: CardValueProjection }) {
  const hasFactors = projection.factors.length > 0;
  if (!hasFactors) return null;

  return (
    <div className="space-y-3">
      {(['live_event', 'game_performance', 'season_arc', 'milestone', 'market', 'negative'] as ProjectionCategory[])
        .map(cat => {
          const catFactors = projection.factors.filter(f => f.category === cat);
          if (catFactors.length === 0) return null;
          return (
            <div key={cat} className="space-y-2">
              {catFactors.map((f, i) => <FactorRow key={i} factor={f} />)}
            </div>
          );
        })}
      <p className="text-[9px] text-gray-700 pt-1 leading-relaxed">
        Projections calibrated from historical collector-market data (PWCC auction results, eBay sold prices, 130point, PSA price guide). Tap 📖 on any factor to see the historical basis.
      </p>
    </div>
  );
}

export default function CardValueProjectionPanel({ projection, priceMultiplier = 1, actualBinPrice, factorsOnly }: Props) {
  const { theme } = useTeam();
  const [showFactors, setShowFactors] = useState(false);

  if (factorsOnly) {
    return <FactorsPanel projection={projection} />;
  }

  // Only show the 24h horizon
  const horizon24h = projection.horizons[1];

  const trendColor =
    projection.overallTrend === 'bullish' ? '#22c55e' :
    projection.overallTrend === 'bearish' ? '#ef4444' : '#6b7280';

  const TrendIcon =
    projection.overallTrend === 'bullish' ? TrendingUp :
    projection.overallTrend === 'bearish' ? TrendingDown : Minus;

  const hasFactors = projection.factors.length > 0;

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5" style={{ color: trendColor }}>
            <TrendIcon size={13} strokeWidth={2.5} />
            <span className="text-xs font-bold uppercase tracking-wider">
              {projection.overallTrend === 'bullish' ? 'Bullish' :
               projection.overallTrend === 'bearish' ? 'Bearish' : 'Neutral'} Outlook
            </span>
          </div>
        </div>
        <span className="text-[10px] text-gray-600 uppercase tracking-wider">Value Projection</span>
      </div>

      {/* Primary driver */}
      {hasFactors && (
        <div className="px-3 pb-2">
          <p className="text-[10px] text-gray-500">
            <span className="text-slate-600 font-semibold">Primary driver:</span>{' '}
            {projection.primaryDriver}
          </p>
        </div>
      )}

      {/* 24-hour projection — full width */}
      {horizon24h && (() => {
        const isPos = horizon24h.pctChange >= 0;
        const color = isPos ? '#22c55e' : '#ef4444';
        const basePrice = actualBinPrice ?? (horizon24h.projectedPrice / (1 + horizon24h.pctChange / 100)) * priceMultiplier;
        const displayPrice = parseFloat((basePrice * (1 + horizon24h.pctChange / 100)).toFixed(2));
        const confidenceDot =
          horizon24h.confidence === 'high' ? '#22c55e' :
          horizon24h.confidence === 'medium' ? '#f59e0b' : '#6b7280';
        return (
          <div className="border-t border-slate-100 px-3 pt-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-gray-600 uppercase tracking-wider font-medium">24 Hours</span>
                <div className="flex items-center gap-0.5" style={{ color }}>
                  {isPos ? <TrendingUp size={11} strokeWidth={2.5} /> : <TrendingDown size={11} strokeWidth={2.5} />}
                  <span className="text-sm font-black tabular-nums">{isPos ? '+' : ''}{horizon24h.pctChange}%</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: confidenceDot }} />
                <span className="text-[9px] text-gray-600 capitalize">{horizon24h.confidence} confidence</span>
              </div>
            </div>
            <MiniProjectionChart
              key={`${basePrice}-${displayPrice}`}
              currentPrice={basePrice}
              projectedPrice={displayPrice}
              pctChange={horizon24h.pctChange}
              confidence={horizon24h.confidence}
              color={color}
            />
          </div>
        );
      })()}

      {/* Factor breakdown toggle */}
      {hasFactors && (
        <>
          <button
            onClick={() => setShowFactors(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 border-t border-slate-100 text-left"
            style={{ color: theme.primary }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {showFactors ? 'Hide' : 'Show'} Factor Breakdown ({projection.factors.length})
            </span>
            <span className="text-[10px]">{showFactors ? '▲' : '▼'}</span>
          </button>

          {showFactors && (
            <div className="px-3 pb-3 space-y-3 border-t border-slate-100 pt-3">
              <FactorsPanel projection={projection} />
            </div>
          )}
        </>
      )}

      {/* No-data state */}
      {!hasFactors && (
        <div className="px-3 pb-3 text-center">
          <p className="text-[10px] text-gray-600">No significant events detected today. Projections will update as game data arrives.</p>
        </div>
      )}
    </div>
  );
}
