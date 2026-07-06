'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { CardPrediction, RookieCardOption } from '@/types';
import { useTeam } from '@/context/TeamContext';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, ExternalLink, ShoppingCart, Star } from 'lucide-react';
import PlayerHeadshot from '@/components/PlayerHeadshot';
import TeamLogo from '@/components/TeamLogo';
import BaseballCardImage from '@/components/BaseballCardImage';
import RobinhoodPriceChart from '@/components/RobinhoodPriceChart';
import CardValueProjectionPanel from '@/components/CardValueProjection';
import { getFeaturedCard } from '@/lib/card-utils';
import { SET_PRICE_MULTIPLIERS } from '@/lib/predictions';
import { useWatchList } from '@/context/WatchListContext';

interface Props {
  prediction: CardPrediction;
  rank: number;
  defaultChartView?: 'season' | 'game';
  isLive?: boolean;
  defaultExpanded?: boolean;
}

const PSA_MULTIPLIERS: Record<number, number> = {
  10: 10.0, 9: 4.0, 8: 2.0, 7: 1.3,
  6: 1.0, 5: 0.75, 4: 0.6, 3: 0.45,
  2: 0.35, 1: 0.25,
};

function psaGradeColor(grade: number): string {
  if (grade === 10) return '#f59e0b';
  if (grade >= 8) return '#22c55e';
  if (grade >= 5) return '#3b82f6';
  return '#ef4444';
}

function psaGradeLabel(grade: number): string {
  if (grade === 10) return 'Gem Mint';
  if (grade === 9) return 'Mint';
  if (grade === 8) return 'NM/MT';
  if (grade === 7) return 'NM';
  if (grade === 6) return 'EX/MT';
  if (grade === 5) return 'EX';
  if (grade === 4) return 'VG/EX';
  if (grade === 3) return 'VG';
  if (grade === 2) return 'Good';
  return 'Poor';
}

// Micro-volatility ticker — simulates live market movement
function useLivePriceTicker(
  basePrice: number,
  direction: 'up' | 'down' | 'neutral',
  active: boolean
) {
  const [livePrice, setLivePrice] = useState(basePrice);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setLivePrice(basePrice); }, [basePrice]);

  useEffect(() => {
    // Tick faster and with more amplitude during live games
    const intervalMs = active ? 3200 : 8500;
    const amplitude = active ? 0.007 : 0.003;
    const bias = direction === 'up' ? 0.0012 : direction === 'down' ? -0.0012 : 0;

    const id = setInterval(() => {
      setLivePrice(prev => {
        const noise = (Math.random() - 0.47) * amplitude;
        const pct = bias + noise;
        const next = parseFloat(
          Math.max(basePrice * 0.94, Math.min(basePrice * 1.06, prev * (1 + pct))).toFixed(2)
        );
        const dir = next >= prev ? 'up' : 'down';
        setFlash(dir);
        if (flashRef.current) clearTimeout(flashRef.current);
        flashRef.current = setTimeout(() => setFlash(null), 650);
        return next;
      });
    }, intervalMs);

    return () => {
      clearInterval(id);
      if (flashRef.current) clearTimeout(flashRef.current);
    };
  }, [active, basePrice, direction]);

  return { livePrice, flash };
}

export default function TrendingPlayerCard({ prediction, rank, defaultChartView, isLive, defaultExpanded }: Props) {
  const { theme } = useTeam();
  const { isWatched, toggleWatch } = useWatchList();
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [selectedCardIdx, setSelectedCardIdx] = useState(0);
  const [gradingMode, setGradingMode] = useState<'raw' | 'psa'>('raw');
  const cardTouchStartRef = useRef<number | null>(null);
  const topCardInnerRef = useRef<HTMLDivElement>(null);
  const [psaGrade, setPsaGrade] = useState(10);

  const isUp = prediction.direction === 'up';
  const directionColor = isUp ? '#22c55e' : '#ef4444';
  const DirectionIcon = isUp ? TrendingUp : TrendingDown;

  const isPitcher = ['P', 'SP', 'RP', 'CP'].includes(prediction.position);
  const stats = prediction.liveStats;

  const rookieOptions: RookieCardOption[] = prediction.rookieCardOptions ?? [];
  const selectedCard = rookieOptions[selectedCardIdx] ?? null;

  const setMultiplier = selectedCard ? (SET_PRICE_MULTIPLIERS[selectedCard.set] ?? 1.0) : 1.0;
  const psaMultiplier = gradingMode === 'psa' ? PSA_MULTIPLIERS[psaGrade] : 1.0;
  const totalMultiplier = setMultiplier * psaMultiplier;

  const baseCurrentPrice = prediction.currentPrice * totalMultiplier;
  const displayProjectedPrice = prediction.projectedPrice * totalMultiplier;

  // Live ticker: always runs when expanded, faster during live games
  const { livePrice, flash } = useLivePriceTicker(
    baseCurrentPrice,
    prediction.direction,
    expanded
  );

  const priceDelta = livePrice - baseCurrentPrice;
  const livePct = baseCurrentPrice > 0 ? (priceDelta / baseCurrentPrice) * 100 : 0;

  const allListings = [
    ...(prediction.priceSummary?.recentSales ?? []),
    ...(prediction.priceSummary?.activeListing ? [prediction.priceSummary.activeListing] : []),
  ];
  const featuredCard = getFeaturedCard(allListings);

  const ebayQuery = [
    prediction.playerName,
    selectedCard ? `${selectedCard.year} ${selectedCard.set}` : 'rookie card',
    gradingMode === 'psa' ? `PSA ${psaGrade}` : '',
  ].filter(Boolean).join(' ');
  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(ebayQuery)}&_sacat=212`;

  // Flash bg color for the live price
  const flashBg = flash === 'up' ? '#22c55e18' : flash === 'down' ? '#ef444418' : 'transparent';

  return (
    <div
      className="rounded-2xl border border-white/10 overflow-hidden"
      style={{ backgroundColor: theme.cardBackground }}
    >
      {/* Collapsed row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(e => !e)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpanded(v => !v); }}
        className="w-full flex items-center gap-3 p-3.5 text-left active:opacity-80 cursor-pointer select-none"
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{
            backgroundColor: rank <= 3 ? `${theme.primary}44` : '#ffffff10',
            color: rank <= 3 ? theme.primary : '#6b7280',
          }}
        >
          {rank}
        </div>

        <PlayerHeadshot playerId={prediction.playerId} playerName={prediction.playerName} size={46} />

        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{prediction.playerName}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <TeamLogo teamId={prediction.teamId} abbreviation="" size={13} />
            <span className="text-gray-400 text-xs">{prediction.position}</span>
            <span className="text-gray-600 text-xs">·</span>
            {!isPitcher ? (
              <span className="text-gray-400 text-xs">
                {stats.hits ?? 0}-{stats.atBats ?? 0}
                {stats.homeRuns ? ` · ${stats.homeRuns} HR` : ''}
                {stats.rbi ? ` · ${stats.rbi} RBI` : ''}
              </span>
            ) : (
              <span className="text-gray-400 text-xs">
                {stats.inningsPitched ?? '0'} IP
                {stats.pitchingStrikeOuts ? ` · ${stats.pitchingStrikeOuts} K` : ''}
                {stats.earnedRuns !== undefined ? ` · ${stats.earnedRuns} ER` : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={e => {
              e.stopPropagation();
              toggleWatch({
                playerId: prediction.playerId,
                playerName: prediction.playerName,
                teamId: prediction.teamId,
                position: prediction.position,
              });
            }}
            className="p-1.5 rounded-lg transition-all"
            style={{
              color: isWatched(prediction.playerId) ? '#f59e0b' : '#4b5563',
              backgroundColor: isWatched(prediction.playerId) ? '#f59e0b18' : 'transparent',
            }}
          >
            <Star size={15} fill={isWatched(prediction.playerId) ? '#f59e0b' : 'none'} />
          </button>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1" style={{ color: directionColor }}>
              <DirectionIcon size={13} strokeWidth={2.5} />
              <span className="text-sm font-bold">
                {prediction.percentageChange > 0 ? '+' : ''}{prediction.percentageChange}%
              </span>
            </div>
            <div className="text-gray-600">
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-4">


          {/* Grading toggle */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Condition</p>
            <div
              className="flex rounded-xl overflow-hidden border border-white/10"
              style={{ backgroundColor: '#ffffff08' }}
            >
              {(['raw', 'psa'] as const).map(mode => {
                const active = gradingMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => setGradingMode(mode)}
                    className="flex-1 py-2 text-xs font-bold transition-all"
                    style={{
                      backgroundColor: active ? `${theme.primary}22` : 'transparent',
                      color: active ? theme.primary : '#6b7280',
                      borderBottom: active ? `2px solid ${theme.primary}` : '2px solid transparent',
                    }}
                  >
                    {mode === 'raw' ? 'Raw / Ungraded' : 'PSA Graded'}
                  </button>
                );
              })}
            </div>

            {gradingMode === 'psa' && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500">PSA Grade</span>
                  <span className="text-xs font-bold" style={{ color: psaGradeColor(psaGrade) }}>
                    PSA {psaGrade} — {psaGradeLabel(psaGrade)}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(g => {
                    const active = psaGrade === g;
                    return (
                      <button
                        key={g}
                        onClick={() => setPsaGrade(g)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{
                          backgroundColor: active ? psaGradeColor(g) : '#ffffff10',
                          color: active ? '#fff' : '#6b7280',
                        }}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-gray-600 mt-1.5 text-center">
                  Prices estimated using industry PSA grade multipliers
                </p>
              </div>
            )}
          </div>

          {/* ── Card valuation — full-width stack ── */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {gradingMode === 'psa' ? `PSA ${psaGrade} Valuation` : 'Highest Rising Card'}
            </p>

            {/* Card stack */}
            {(() => {
              const stackCount = Math.min(rookieOptions.length - selectedCardIdx, 3);
              if (stackCount === 0) return null;
              return (
                <div className="relative w-full" style={{ aspectRatio: '2.5/3.5' }}>
                  {Array.from({ length: stackCount }, (_, depth) => {
                    const cardIdx = selectedCardIdx + depth;
                    const opt = rookieOptions[cardIdx];
                    const isTop = depth === 0;
                    return (
                      <div
                        key={`${opt.year}-${opt.set}`}
                        className="absolute inset-0 overflow-hidden"
                        style={{
                          borderRadius: 8,
                          zIndex: stackCount - depth,
                          transform: `translateY(${depth * 7}px) scale(${1 - depth * 0.04})`,
                          transformOrigin: 'top center',
                          transition: 'transform 0.25s ease',
                          boxShadow: isTop ? '0 6px 28px rgba(0,0,0,0.65)' : '0 2px 10px rgba(0,0,0,0.35)',
                        }}
                      >
                        <div
                          ref={isTop ? topCardInnerRef : undefined}
                          style={{ width: '100%', height: '100%' }}
                          onTouchStart={!isTop ? undefined : e => {
                            cardTouchStartRef.current = e.touches[0].clientX;
                          }}
                          onTouchMove={!isTop ? undefined : e => {
                            if (cardTouchStartRef.current === null || !topCardInnerRef.current) return;
                            const dx = e.touches[0].clientX - cardTouchStartRef.current;
                            topCardInnerRef.current.style.transition = 'none';
                            topCardInnerRef.current.style.transform = `translateX(${dx}px) rotate(${dx * 0.035}deg)`;
                          }}
                          onTouchEnd={!isTop ? undefined : e => {
                            if (cardTouchStartRef.current === null) return;
                            const diff = cardTouchStartRef.current - e.changedTouches[0].clientX;
                            cardTouchStartRef.current = null;
                            const el = topCardInnerRef.current;
                            if (!el) return;
                            if (Math.abs(diff) < 8) {
                              el.style.transition = '';
                              el.style.transform = '';
                            } else if (diff > 50 && selectedCardIdx < rookieOptions.length - 1) {
                              el.style.transition = 'transform 0.28s ease-in, opacity 0.28s ease-in';
                              el.style.transform = 'translateX(-160%) rotate(-15deg)';
                              el.style.opacity = '0';
                              setTimeout(() => setSelectedCardIdx(i => i + 1), 250);
                            } else if (diff < -50 && selectedCardIdx > 0) {
                              el.style.transition = 'transform 0.28s ease-in, opacity 0.28s ease-in';
                              el.style.transform = 'translateX(160%) rotate(15deg)';
                              el.style.opacity = '0';
                              setTimeout(() => setSelectedCardIdx(i => i - 1), 250);
                            } else {
                              el.style.transition = 'transform 0.22s ease-out';
                              el.style.transform = '';
                            }
                          }}
                        >
                          <BaseballCardImage
                            playerId={prediction.playerId}
                            playerName={prediction.playerName}
                            teamId={prediction.teamId}
                            position={prediction.position}
                            cardType="Rookie Card"
                            cardYear={opt.year}
                            cardSet={opt.set}
                            ebayImageUrl={cardIdx === 0 ? prediction.priceSummary?.activeListing?.imageUrl : undefined}
                            width={300}
                            height={420}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Stack dots */}
            {rookieOptions.length > 1 && (
              <div className="flex justify-center gap-1.5 py-2">
                {rookieOptions.map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full transition-all"
                    style={{ backgroundColor: i === selectedCardIdx ? '#ffffff' : '#ffffff33' }}
                  />
                ))}
              </div>
            )}

            {/* Price info */}
            <div
              className="rounded-xl px-3 py-2.5 mt-2 flex flex-col gap-1"
              style={{ backgroundColor: '#ffffff08', transition: 'background-color 0.6s ease-out', ...(flash ? { backgroundColor: flashBg } : {}) }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="font-black text-xl tabular-nums" style={{ color: flash === 'up' ? '#22c55e' : flash === 'down' ? '#ef4444' : '#fff', transition: 'color 0.3s' }}>
                    ${livePrice.toFixed(2)}
                  </span>
                  <span className="text-xs" style={{ color: livePct >= 0 ? '#22c55e' : '#ef4444' }}>
                    {livePct >= 0 ? '+' : ''}{livePct.toFixed(2)}%
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#ffffff10', color: '#9ca3af' }}>
                  {prediction.confidence} confidence
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 text-[10px]">proj.</span>
                <span className="text-gray-300 text-[10px] font-semibold tabular-nums">${displayProjectedPrice.toFixed(2)}</span>
                <span className="text-[10px]" style={{ color: directionColor }}>
                  ({prediction.percentageChange > 0 ? '+' : ''}{prediction.percentageChange}%)
                </span>
              </div>
              {selectedCard && (
                <p className="text-gray-500 text-[10px] mt-0.5">
                  {prediction.playerName} {selectedCard.year} {selectedCard.set} RC
                  {gradingMode === 'psa' ? ` · PSA ${psaGrade}` : ''}
                </p>
              )}
            </div>

            {/* eBay CTA */}
            <a
              href={ebayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 mt-3 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: theme.primary, color: '#fff' }}
            >
              <ShoppingCart size={14} />
              {gradingMode === 'psa'
                ? `Shop PSA ${psaGrade} ${selectedCard?.shortName ?? 'RC'} on eBay`
                : `Shop ${prediction.playerName} Cards on eBay`}
              <ExternalLink size={12} />
            </a>
          </div>

          {/* ── Value Projection Engine ── */}
          {prediction.projection && (
            <CardValueProjectionPanel
              projection={prediction.projection}
              priceMultiplier={totalMultiplier}
            />
          )}

          {/* ── Price history + forecast chart — BELOW card ── */}
          <RobinhoodPriceChart
            prediction={prediction}
            defaultView={defaultChartView}
            priceMultiplier={totalMultiplier}
            isLive={isLive}
          />

        </div>
      )}
    </div>
  );
}
