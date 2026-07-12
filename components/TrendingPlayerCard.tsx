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

// Percentage micro-drift — always-on slow movement; larger swings when active
function useLivePercentageTicker(
  basePct: number,
  direction: 'up' | 'down' | 'neutral',
  isLiveGame: boolean
) {
  const [livePct, setLivePct] = useState(basePct);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setLivePct(basePct); }, [basePct]);

  useEffect(() => {
    // Always drift slowly; speed up and widen amplitude during live games
    const intervalMs = isLiveGame ? 2400 : 5500;
    const amplitude = isLiveGame ? 0.22 : 0.08; // percentage points per tick
    const bias = direction === 'up' ? 0.03 : direction === 'down' ? -0.03 : 0;
    const cap = isLiveGame ? 3.5 : 1.5; // max drift from base

    const id = setInterval(() => {
      setLivePct(prev => {
        const noise = (Math.random() - 0.47) * amplitude;
        const next = parseFloat(
          Math.max(basePct - cap, Math.min(basePct + cap, prev + bias + noise)).toFixed(1)
        );
        const dir = next >= prev ? 'up' : 'down';
        setFlash(dir);
        if (flashRef.current) clearTimeout(flashRef.current);
        flashRef.current = setTimeout(() => setFlash(null), 500);
        return next;
      });
    }, intervalMs);

    return () => {
      clearInterval(id);
      if (flashRef.current) clearTimeout(flashRef.current);
    };
  }, [isLiveGame, basePct, direction]);

  return { livePct, flash };
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
  const [ebayRateLimited, setEbayRateLimited] = useState(false);

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
      .then(({ sets, rateLimited }: { sets: SetCardResult[]; rateLimited?: boolean }) => {
        setSetCards(sets ?? []);
        setEbayRateLimited(!!rateLimited);
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

  // When a real BIN price exists, anchor the chart to it rather than the static multiplier.
  // This ensures the chart reflects the actual market price of the card in view.
  const chartMultiplier = (actualBinPrice !== null && prediction.currentPrice > 0)
    ? actualBinPrice / prediction.currentPrice
    : totalMultiplier;

  const baseCurrentPrice = prediction.currentPrice * totalMultiplier;

  // Live ticker: runs as fallback when no real BIN price is available
  const { livePrice, flash } = useLivePriceTicker(
    baseCurrentPrice,
    prediction.direction,
    expanded
  );

  // Always-on percentage drift — always running, faster during live games
  const { livePct, flash: pctFlash } = useLivePercentageTicker(
    prediction.percentageChange,
    prediction.direction,
    !!isLive
  );

  const allListings = [
    ...(prediction.priceSummary?.recentSales ?? []),
    ...(prediction.priceSummary?.activeListing ? [prediction.priceSummary.activeListing] : []),
  ];
  const featuredCard = getFeaturedCard(allListings);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
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
            <div
              className="flex items-center gap-1"
              style={{
                color: pctFlash === 'up' ? '#22c55e' : pctFlash === 'down' ? '#ef4444' : directionColor,
                transition: 'color 0.4s ease-out',
              }}
            >
              <DirectionIcon size={13} strokeWidth={2.5} />
              <span className="text-sm font-bold tabular-nums">
                {livePct >= 0 ? '+' : ''}{livePct.toFixed(1)}%
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

          {/* ── Card carousel — top of panel ── */}
          {!hideCardImage && <div>

            {/* Jukebox carousel with price overlay — only shown once real eBay listings are loaded */}
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
                overlayRenderer={(rawCard, _idx, isActive) => {
                  const card = rawCard as SetCardResult;
                  const cardMultiplier = SET_PRICE_MULTIPLIERS[card.set] ?? 1.0;
                  const cardBinPrice = card.binPrice;
                  const priceNum = cardBinPrice !== null
                    ? cardBinPrice
                    : isActive
                      ? livePrice
                      : prediction.currentPrice * cardMultiplier;
                  const priceColor = isActive && cardBinPrice === null
                    ? (flash === 'up' ? '#22c55e' : flash === 'down' ? '#ef4444' : '#fff')
                    : '#fff';
                  const label = `${prediction.playerName} ${card.year} ${card.set} RC`;
                  const forecastPrice = priceNum * (1 + prediction.percentageChange / 100);
                  const forecastPct = prediction.percentageChange;
                  const forecastColor = forecastPct >= 0 ? '#22c55e' : '#ef4444';

                  return (
                    <div style={{
                      background: 'linear-gradient(180deg, rgba(6,10,24,0.88) 0%, rgba(4,7,16,0.94) 100%)',
                      backdropFilter: 'blur(16px) saturate(160%)',
                      WebkitBackdropFilter: 'blur(16px) saturate(160%)',
                      borderTop: '1px solid rgba(255,255,255,0.07)',
                      padding: '10px 12px 12px',
                    }}>
                      {/* Price + forecast row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 900, fontSize: 20, color: priceColor, transition: 'color 0.3s', lineHeight: 1 }}>
                          ${priceNum.toFixed(2)}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Forecast</span>
                          <span style={{ color: forecastColor, fontWeight: 700, fontSize: 12, lineHeight: 1 }}>
                            ${forecastPrice.toFixed(2)} {forecastPct >= 0 ? '↑+' : '↓'}{forecastPct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, marginBottom: 9 }}>{label}</p>
                      <a
                        href={card.itemUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'block',
                          textAlign: 'center',
                          background: '#22c55e',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: 12,
                          padding: '7px 12px',
                          borderRadius: 7,
                          textDecoration: 'none',
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        Buy It Now
                      </a>
                    </div>
                  );
                }}
              />
            ) : (
              <div className="glass-card-inset flex flex-col items-center justify-center gap-1 rounded-xl" style={{ aspectRatio: '9/12' }}>
                <p className="text-gray-600 text-xs text-center px-4">
                  {cardsFetchStatus !== 'done'
                    ? 'Loading listings…'
                    : ebayRateLimited
                    ? 'eBay temporarily unavailable'
                    : 'No listings found'}
                </p>
                {ebayRateLimited && (
                  <p className="text-gray-700 text-[10px] text-center px-4">Check back in a few minutes</p>
                )}
              </div>
            )}

          </div>}

          {/* ── Factor breakdown — always visible, no header ── */}
          {prediction.projection && (
            <CardValueProjectionPanel
              projection={prediction.projection}
              priceMultiplier={totalMultiplier}
              actualBinPrice={actualBinPrice}
              factorsOnly
            />
          )}

          {/* ── Price history + forecast chart ── */}
          <RobinhoodPriceChart
            prediction={prediction}
            defaultView={defaultChartView}
            priceMultiplier={chartMultiplier}
            isLive={isLive}
          />

        </div>
      )}
    </div>
  );
}
