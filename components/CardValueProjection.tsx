'use client';

import { CardValueProjection, ProjectionFactor, ProjectionCategory } from '@/types';
import { TrendingUp, TrendingDown, Minus, Zap, BarChart2, Star, ShieldAlert, Activity, BookOpen } from 'lucide-react';
import { useTeam } from '@/context/TeamContext';
import { useState } from 'react';

interface Props {
  projection: CardValueProjection;
  priceMultiplier?: number;
  actualBinPrice?: number | null;
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
        <span className="text-white text-xs font-medium flex-1 truncate">{factor.label}</span>

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
          className="ml-2 pl-2 border-l text-[10px] text-gray-400 leading-relaxed"
          style={{ borderColor: catColor + '40' }}
        >
          {factor.historicalBasis}
        </div>
      )}
    </div>
  );
}

export default function CardValueProjectionPanel({ projection, priceMultiplier = 1, actualBinPrice }: Props) {
  const { theme } = useTeam();
  const [showFactors, setShowFactors] = useState(false);

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
    <div className="rounded-xl overflow-hidden border border-white/10" style={{ backgroundColor: '#ffffff05' }}>
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
            <span className="text-gray-400 font-semibold">Primary driver:</span>{' '}
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
          <div className="border-t border-white/5 px-3 py-3 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-gray-600 uppercase tracking-wider font-medium">24 Hours</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex items-center gap-0.5" style={{ color }}>
                  {isPos ? <TrendingUp size={13} strokeWidth={2.5} /> : <TrendingDown size={13} strokeWidth={2.5} />}
                  <span className="text-lg font-black tabular-nums">{isPos ? '+' : ''}{horizon24h.pctChange}%</span>
                </div>
                <span className="text-gray-400 text-sm font-semibold tabular-nums">${displayPrice}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: confidenceDot }} />
              <span className="text-[9px] text-gray-600 capitalize">{horizon24h.confidence} confidence</span>
            </div>
          </div>
        );
      })()}

      {/* Factor breakdown toggle */}
      {hasFactors && (
        <>
          <button
            onClick={() => setShowFactors(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 border-t border-white/5 text-left"
            style={{ color: theme.primary }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {showFactors ? 'Hide' : 'Show'} Factor Breakdown ({projection.factors.length})
            </span>
            <span className="text-[10px]">{showFactors ? '▲' : '▼'}</span>
          </button>

          {showFactors && (
            <div className="px-3 pb-3 space-y-3 border-t border-white/5 pt-3">
              {/* Group by category */}
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
