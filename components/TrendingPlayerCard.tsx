'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { CardPrediction, RookieCardOption, SetCardResult } from '@/types';
import { useTeam } from '@/context/TeamContext';
import { useGrading } from '@/context/GradingContext';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Star } from 'lucide-react';
import PlayerHeadshot from '@/components/PlayerHeadshot';
import TeamLogo from '@/components/TeamLogo';
import BaseballCardImage from '@/components/BaseballCardImage';
import RobinhoodPriceChart from '@/components/RobinhoodPriceChart';
import CardValueProjectionPanel from '@/components/CardValueProjection';
import CardPeekCarousel from '@/components/CardPeekCarousel';
import { getFeaturedCard } from '@/lib/card-utils';
import { SET_PRICE_MULTIPLIERS } from '@/lib/predictions';
import { useWatchList } from '@/context/WatchListContext';

interface Props {
  prediction: CardPrediction;
  rank: number;
  defaultChartView?: 'season' | 'game';
  isLive?: boolean;
  defaultExpanded?: boolean;
  hideCardImage?: boolean;
  forceExpanded?: boolean;
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

export default function TrendingPlayerCard({ prediction, rank, defaultChartView, isLive, defaultExpanded, hideCardImage, forceExpanded }: Props) {
  const { theme } = useTeam();
  const { isWatched, toggleWatch } = useWatchList();
  const { companyId: gradingCompanyId, gradeValue: gradingGradeValue } = useGrading();
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [setCards, setSetCards] = useState<SetCardResult[]>([]);
  const [cardsFetchStatus, setCardsFetchStatus] = useState<'idle' | 'loading' | 'done'>('idle');

  useEffect(() => {
    if (forceExpanded) setExpanded(true);
  }, [forceExpanded]);

  // Fetch eBay listings when the panel is open.
  // Depend on both expanded and forceExpanded so that forceExpanded=true
  // triggers the fetch immediately — without waiting for the two-effect
  // hop of forceExpanded → setExpanded → expanded effect.
  useEffect(() => {
    const isOpen = expanded || !!forceExpanded;
    if (!isOpen) return;
    if (cardsFetchStatus === 'loading' || (cardsFetchStatus === 'done' && setCards.length > 0)) return;
    setCardsFetchStatus('loading');
    const year = prediction.rookieCardOptions?.[0]?.year;
    const params = new URLSearchParams({ name: prediction.playerName });
    if (year) params.set('year', String(year));
    if (gradingCompanyId) {
      params.set('grading', gradingCompanyId);
      if (gradingGradeValue) params.set('grade', gradingGradeValue);
    }
    fetch(`/api/player/${prediction.playerId}/cards?${params}`)
      .then(r => r.json())
      .then(({ sets }: { sets: SetCardResult[] }) => {
        setSetCards(sets ?? []);
        setCardsFetchStatus('done');
      })
      .catch(() => setCardsFetchStatus('done'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, forceExpanded]);

  const [selectedCardIdx, setSelectedCardIdx] = useState(0);

  const isUp = prediction.direction === 'up';
  const directionColor = isUp ? '#22c55e' : '#ef4444';
  const DirectionIcon = isUp ? TrendingUp : TrendingDown;

  const isPitcher = ['P', 'SP', 'RP', 'CP'].includes(prediction.position);
  const stats = prediction.liveStats;

  const selectedCard = setCards[selectedCardIdx] ?? null;

  const totalMultiplier = selectedCard ? (SET_PRICE_MULTIPLIERS[selectedCard.set] ?? 1.0) : 1.0;

  // Real eBay listing prices — used instead of the simulated ticker when available
  const selectedSetCard = setCards.length > 0 ? (setCards[selectedCardIdx] ?? null) : null;
  const actualBinPrice: number | null = selectedSetCard?.binPrice ?? null;
  const actualSoldPrice: number | null = selectedSetCard?.soldPrice ?? null;

  const baseCurrentPrice = prediction.currentPrice * totalMultiplier;
  const displayProjectedPrice = prediction.projectedPrice * totalMultiplier;

  // Live ticker: runs as fallback when no real BIN price is available
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
      {(expanded || !!forceExpanded) && (
        <div className="border-t border-white/10 p-4 space-y-4">


          {/* ── Card valuation — full-width stack ── */}
          {!hideCardImage && <div>

            {/* Price info — above the card, updates on swipe */}
            <div
              className="rounded-xl px-3 py-2.5 mb-3 flex flex-col gap-1"
              style={{
                backgroundColor: actualBinPrice === null && flash ? flashBg : '#ffffff08',
                transition: 'background-color 0.6s ease-out',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  {actualBinPrice !== null ? (
                    <>
                      <span className="font-black text-xl tabular-nums" style={{ color: '#fff' }}>
                        ${actualBinPrice.toFixed(2)}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: '#22c55e18', color: '#22c55e' }}>
                        BIN
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-black text-xl tabular-nums" style={{ color: flash === 'up' ? '#22c55e' : flash === 'down' ? '#ef4444' : '#fff', transition: 'color 0.3s' }}>
                        ${livePrice.toFixed(2)}
                      </span>
                      <span className="text-xs" style={{ color: livePct >= 0 ? '#22c55e' : '#ef4444' }}>
                        {livePct >= 0 ? '+' : ''}{livePct.toFixed(2)}%
                      </span>
                    </>
                  )}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#ffffff10', color: '#9ca3af' }}>
                  {prediction.confidence} confidence
                </span>
              </div>

              {actualBinPrice !== null ? (
                actualSoldPrice !== null && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500 text-[10px]">last sold</span>
                    <span className="text-gray-300 text-[10px] font-semibold tabular-nums">${actualSoldPrice.toFixed(2)}</span>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 text-[10px]">proj.</span>
                  <span className="text-gray-300 text-[10px] font-semibold tabular-nums">${displayProjectedPrice.toFixed(2)}</span>
                  <span className="text-[10px]" style={{ color: directionColor }}>
                    ({prediction.percentageChange > 0 ? '+' : ''}{prediction.percentageChange}%)
                  </span>
                </div>
              )}

              {selectedCard && (
                <p className="text-gray-500 text-[10px] mt-0.5">
                  {prediction.playerName} {selectedCard.year} {selectedCard.set} RC
                </p>
              )}
            </div>

            {/* Jukebox carousel — only shown once real eBay listings are loaded */}
            {setCards.length > 0 ? (
              <CardPeekCarousel
                cards={setCards}
                onActiveChange={setSelectedCardIdx}
                renderFallback={(card, idx) => (
                  <BaseballCardImage
                    playerId={prediction.playerId}
                    playerName={prediction.playerName}
                    teamId={prediction.teamId}
                    position={prediction.position}
                    cardType="Rookie Card"
                    cardYear={card.year}
                    cardSet={card.set}
                    ebayImageUrl={idx === 0 ? prediction.priceSummary?.activeListing?.imageUrl : undefined}
                    fill
                  />
                )}
              />
            ) : (
              <div className="flex items-center justify-center rounded-xl" style={{ aspectRatio: '2.5/3.5', backgroundColor: '#ffffff08' }}>
                <p className="text-gray-600 text-xs">
                  {cardsFetchStatus === 'done' ? 'No listings found' : 'Loading listings…'}
                </p>
              </div>
            )}

          </div>}

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
