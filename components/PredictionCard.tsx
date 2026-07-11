'use client';

import { CardPrediction } from '@/types';
import { useTeam } from '@/context/TeamContext';
import { TrendingUp, TrendingDown, Minus, ExternalLink, ShoppingCart } from 'lucide-react';
import { getEbaySearchUrl } from '@/lib/ebay-utils';
import LivePercentage from '@/components/LivePercentage';

interface Props {
  prediction: CardPrediction;
}

const CONFIDENCE_COLORS = {
  high: 'text-emerald-400 bg-emerald-400/10',
  medium: 'text-yellow-400 bg-yellow-400/10',
  low: 'text-gray-400 bg-gray-400/10',
};

export default function PredictionCard({ prediction }: Props) {
  const { theme } = useTeam();
  const isUp = prediction.direction === 'up';
  const isDown = prediction.direction === 'down';

  const directionColor = isUp ? '#22c55e' : isDown ? '#ef4444' : '#9ca3af';
  const DirectionIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  const ebayUrl = prediction.priceSummary?.activeListing?.itemUrl
    || getEbaySearchUrl(prediction.playerName);

  return (
    <div
      className="rounded-2xl p-4 border border-white/10 flex flex-col gap-3"
      style={{ backgroundColor: theme.cardBackground }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{prediction.playerName}</p>
          <p className="text-xs text-gray-400">{prediction.position}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1" style={{ color: directionColor }}>
            <DirectionIcon size={16} strokeWidth={2.5} />
            <LivePercentage
              value={prediction.percentageChange}
              direction={prediction.direction}
              className="text-sm font-bold tabular-nums"
            />
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_COLORS[prediction.confidence]}`}>
            {prediction.confidence} conf.
          </span>
        </div>
      </div>

      {/* Price info */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl p-2.5" style={{ backgroundColor: '#ffffff08' }}>
          <p className="text-xs text-gray-400 mb-0.5">Current Avg</p>
          <p className="text-base font-bold text-white">${prediction.currentPrice.toFixed(2)}</p>
        </div>
        <div
          className="rounded-xl p-2.5"
          style={{ backgroundColor: isUp ? '#22c55e12' : isDown ? '#ef444412' : '#ffffff08' }}
        >
          <p className="text-xs text-gray-400 mb-0.5">Projected</p>
          <p className="text-base font-bold" style={{ color: directionColor }}>
            ${prediction.projectedPrice.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Today's stats */}
      <div className="rounded-xl p-2.5" style={{ backgroundColor: '#ffffff08' }}>
        <p className="text-xs text-gray-400 mb-1.5 font-medium">Today's Stats</p>
        <div className="flex flex-wrap gap-2">
          {prediction.liveStats.homeRuns !== undefined && (
            <Stat label="HR" value={String(prediction.liveStats.homeRuns)} />
          )}
          {prediction.liveStats.hits !== undefined && (
            <Stat label="H" value={String(prediction.liveStats.hits)} />
          )}
          {prediction.liveStats.atBats !== undefined && (
            <Stat label="AB" value={String(prediction.liveStats.atBats)} />
          )}
          {prediction.liveStats.rbi !== undefined && (
            <Stat label="RBI" value={String(prediction.liveStats.rbi)} />
          )}
          {prediction.liveStats.inningsPitched && (
            <Stat label="IP" value={prediction.liveStats.inningsPitched} />
          )}
          {prediction.liveStats.pitchingStrikeOuts !== undefined && (
            <Stat label="K" value={String(prediction.liveStats.pitchingStrikeOuts)} />
          )}
          {prediction.liveStats.earnedRuns !== undefined && (
            <Stat label="ER" value={String(prediction.liveStats.earnedRuns)} />
          )}
        </div>
      </div>

      {/* Reasons */}
      {prediction.reasons.length > 0 && (
        <div className="space-y-1">
          {prediction.reasons.slice(0, 3).map((reason, i) => (
            <p key={i} className="text-xs text-gray-400 flex items-center gap-1.5">
              <span style={{ color: directionColor }}>•</span>
              {reason}
            </p>
          ))}
        </div>
      )}

      {/* eBay CTA */}
      <a
        href={ebayUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ backgroundColor: theme.primary, color: '#fff' }}
      >
        <ShoppingCart size={14} />
        View on eBay
        <ExternalLink size={12} />
      </a>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-white font-bold text-sm">{value}</p>
      <p className="text-gray-500 text-xs">{label}</p>
    </div>
  );
}
