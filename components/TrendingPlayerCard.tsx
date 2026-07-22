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
import { HofResult } from '@/lib/hof-probability';

const BENCHMARK_STYLES: Record<string, { color: string }> = {
  'Career Hits':       { color: '#3b82f6' },
  'Home Runs':         { color: '#ef4444' },
  'RBI':               { color: '#f97316' },
  'Career AVG':        { color: '#22c55e' },
  'Career OPS':        { color: '#a855f7' },
  'Career Strikeouts': { color: '#3b82f6' },
  'Career Wins':       { color: '#22c55e' },
  'Career ERA':        { color: '#ef4444' },
  'Career WHIP':       { color: '#f97316' },
  'Innings Pitched':   { color: '#a855f7' },
};
const DEFAULT_BENCHMARK_STYLE = { color: '#6b7280' };

// <50%: grey. 50-66%: bronze. 67-83%: silver. 84-100%: gold.
const METAL_DEFS = {
  gold: {
    label: 'Gold' as const,
    main: '#D4AF37',
    glow: 'rgba(212,175,55,0.45)',
    // Mini bar gradient (white bg)
    cssGradient:     'linear-gradient(135deg, #5A3E00 0%, #C8970F 25%, #FFF4B5 50%, #C8970F 75%, #5A3E00 100%)',
    // Metallic bar fill — vertical gradient simulating a cylindrical rod
    barFill:         'linear-gradient(180deg, rgba(255,252,180,0.92) 0%, #E8C030 38%, #8A6000 100%)',
    sectionBg:       'linear-gradient(rgba(0,0,0,0.52), rgba(0,0,0,0.52)), url(/hof/gold.png) center/cover no-repeat',
    glassBg:         'rgba(255,220,90,0.08)',
    glassBorder:     'rgba(255,238,160,0.30)',
    engraveColor:    'rgba(255,252,230,0.93)',
    engraveSubColor: 'rgba(255,238,185,0.68)',
    engraveShadow:   '0 1px 3px rgba(0,0,0,0.75)',
    grooveTrack:     'rgba(0,0,0,0.45)',
    svgTrackColor:   'rgba(0,0,0,0.45)',
    svgFillColor:    'rgba(255,255,255,0.55)',
    svgTextColor:    'rgba(255,252,230,0.93)',
    svgSubTextColor: 'rgba(245,218,155,0.62)',
    svgStops: [
      { offset: '0%',   color: '#5A3E00' },
      { offset: '30%',  color: '#D4AF37' },
      { offset: '50%',  color: '#FFF4B5' },
      { offset: '70%',  color: '#D4AF37' },
      { offset: '100%', color: '#5A3E00' },
    ],
  },
  silver: {
    label: 'Silver' as const,
    main: '#C0C0C0',
    glow: 'rgba(192,192,192,0.35)',
    cssGradient:     'linear-gradient(135deg, #3A3A3A 0%, #A8A8A8 25%, #F0F0F0 50%, #A8A8A8 75%, #3A3A3A 100%)',
    barFill:         'linear-gradient(180deg, rgba(245,248,255,0.92) 0%, #C0C4D0 38%, #505060 100%)',
    sectionBg:       'linear-gradient(rgba(0,0,0,0.52), rgba(0,0,0,0.52)), url(/hof/silver.png) center/cover no-repeat',
    glassBg:         'rgba(210,220,240,0.09)',
    glassBorder:     'rgba(255,255,255,0.30)',
    engraveColor:    'rgba(248,250,255,0.93)',
    engraveSubColor: 'rgba(218,225,240,0.68)',
    engraveShadow:   '0 1px 3px rgba(0,0,0,0.75)',
    grooveTrack:     'rgba(0,0,0,0.45)',
    svgTrackColor:   'rgba(0,0,0,0.45)',
    svgFillColor:    'rgba(255,255,255,0.58)',
    svgTextColor:    'rgba(248,250,255,0.93)',
    svgSubTextColor: 'rgba(200,210,230,0.62)',
    svgStops: [
      { offset: '0%',   color: '#3A3A3A' },
      { offset: '30%',  color: '#C0C0C0' },
      { offset: '50%',  color: '#F0F0F0' },
      { offset: '70%',  color: '#C0C0C0' },
      { offset: '100%', color: '#3A3A3A' },
    ],
  },
  copper: {
    label: 'Copper' as const,
    main: '#B87333',
    glow: 'rgba(184,115,51,0.4)',
    cssGradient:     'linear-gradient(135deg, #3E1A00 0%, #A05520 25%, #E8A060 50%, #A05520 75%, #3E1A00 100%)',
    barFill:         'linear-gradient(180deg, rgba(255,215,150,0.92) 0%, #C07830 38%, #5A2800 100%)',
    sectionBg:       'linear-gradient(rgba(0,0,0,0.52), rgba(0,0,0,0.52)), url(/hof/copper.png) center/cover no-repeat',
    glassBg:         'rgba(220,135,75,0.08)',
    glassBorder:     'rgba(255,200,150,0.28)',
    engraveColor:    'rgba(255,248,238,0.93)',
    engraveSubColor: 'rgba(255,225,200,0.68)',
    engraveShadow:   '0 1px 3px rgba(0,0,0,0.75)',
    grooveTrack:     'rgba(0,0,0,0.45)',
    svgTrackColor:   'rgba(0,0,0,0.45)',
    svgFillColor:    'rgba(255,255,255,0.55)',
    svgTextColor:    'rgba(255,248,238,0.93)',
    svgSubTextColor: 'rgba(240,208,178,0.62)',
    svgStops: [
      { offset: '0%',   color: '#3E1A00' },
      { offset: '30%',  color: '#B87333' },
      { offset: '50%',  color: '#E8A060' },
      { offset: '70%',  color: '#B87333' },
      { offset: '100%', color: '#3E1A00' },
    ],
  },
  none: {
    label: null,
    main: '#9CA3AF',
    glow: 'rgba(156,163,175,0.15)',
    cssGradient:     '#D1D5DB',
    barFill:         '#D1D5DB',
    sectionBg:       'transparent',
    glassBg:         'transparent',
    glassBorder:     'transparent',
    engraveColor:    '#374151',
    engraveSubColor: '#9CA3AF',
    engraveShadow:   'none',
    grooveTrack:     '#00000009',
    svgTrackColor:   '#00000008',
    svgFillColor:    '#D1D5DB',
    svgTextColor:    '#9ca3af',
    svgSubTextColor: '#9ca3af',
    svgStops: [
      { offset: '0%',   color: '#9CA3AF' },
      { offset: '100%', color: '#9CA3AF' },
    ],
  },
} as const;

function metalFor(probability: number) {
  if (probability >= 84) return METAL_DEFS.gold;
  if (probability >= 67) return METAL_DEFS.silver;
  if (probability >= 50) return METAL_DEFS.copper;
  return METAL_DEFS.none;
}

function BenchmarkIcon({ label, size = 13, color = 'currentColor' }: { label: string; size?: number; color?: string }) {
  const base = { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (label) {
    // ── Hitters ──
    case 'Career Hits': // bat + ball
      return <svg {...base}><line x1="2" y1="14" x2="11" y2="5" strokeWidth="2.5" /><circle cx="12.5" cy="3.5" r="2" fill={color} stroke="none" /></svg>;
    case 'Home Runs': // ball with arc over fence
      return <svg {...base}><circle cx="7" cy="11" r="3.5" strokeWidth="1.5" /><path d="M9.5 8 Q11 3 15 4" strokeWidth="1.5" strokeDasharray="1.5 1" /><line x1="1" y1="13" x2="15" y2="13" strokeWidth="1.5" /></svg>;
    case 'RBI': // home plate + runner arrow
      return <svg {...base}><path d="M8 3 L13 7 L13 11 L3 11 L3 7 Z" strokeWidth="1.5" /><line x1="8" y1="1" x2="8" y2="3" strokeWidth="1.5" /><polyline points="6,2 8,0.5 10,2" strokeWidth="1.5" /></svg>;
    case 'Career AVG': // three stat bars
      return <svg {...base}><rect x="1.5" y="10" width="3" height="5" rx="0.5" fill={color} stroke="none" /><rect x="6.5" y="6" width="3" height="9" rx="0.5" fill={color} stroke="none" /><rect x="11.5" y="8" width="3" height="7" rx="0.5" fill={color} stroke="none" /></svg>;
    case 'Career OPS': // lightning bolt (power)
      return <svg {...base}><polyline points="10,1 5,9 9,9 6,15 13,6 9,6" strokeWidth="1.5" fill={color} fillOpacity="0.15" /></svg>;
    // ── Pitchers ──
    case 'Career Strikeouts': // stylised K
      return <svg {...base}><line x1="4" y1="2" x2="4" y2="14" strokeWidth="2" /><line x1="4" y1="8" x2="12" y2="2" strokeWidth="1.75" /><line x1="4" y1="8" x2="12" y2="14" strokeWidth="1.75" /></svg>;
    case 'Career Wins': // trophy cup
      return <svg {...base}><path d="M4 2 H12 V8 Q12 13 8 13 Q4 13 4 8 Z" strokeWidth="1.5" /><path d="M4 4 Q1.5 4 1.5 7 Q1.5 10 4 10" strokeWidth="1.5" /><path d="M12 4 Q14.5 4 14.5 7 Q14.5 10 12 10" strokeWidth="1.5" /><line x1="8" y1="13" x2="8" y2="15" strokeWidth="1.5" /><line x1="5" y1="15" x2="11" y2="15" strokeWidth="1.5" /></svg>;
    case 'Career ERA': // bullseye / target
      return <svg {...base}><circle cx="8" cy="8" r="6.5" strokeWidth="1.5" /><circle cx="8" cy="8" r="3.5" strokeWidth="1.5" /><circle cx="8" cy="8" r="1" fill={color} stroke="none" /></svg>;
    case 'Career WHIP': // pitching arc / whip curve
      return <svg {...base}><path d="M2 10 Q4 3 9 5 Q14 7 13 12 Q12 15 9 14" strokeWidth="1.75" fill="none" /></svg>;
    case 'Innings Pitched': // clock face (durability)
      return <svg {...base}><circle cx="8" cy="8" r="6.5" strokeWidth="1.5" /><line x1="8" y1="8" x2="8" y2="3.5" strokeWidth="1.75" /><line x1="8" y1="8" x2="11.5" y2="10" strokeWidth="1.75" /></svg>;
    default:
      return <svg {...base}><circle cx="8" cy="8" r="6.5" strokeWidth="1.5" /></svg>;
  }
}

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

  const [hofData, setHofData] = useState<HofResult | null>(null);

  useEffect(() => {
    fetch(`/api/player/${prediction.playerId}/hof`)
      .then(r => r.json())
      .then((d: HofResult & { error?: string }) => { if (!d.error) setHofData(d); })
      .catch(() => {});
  }, [prediction.playerId]);

  const [selectedCardIdx, setSelectedCardIdx] = useState(0);

  const hofSectionRef = useRef<HTMLDivElement>(null);
  const [hofParallax, setHofParallax] = useState(0);

  useEffect(() => {
    if (!expanded || !hofData) return;
    const m = metalFor(hofData.probability);
    if (!m.label) return;
    const el = hofSectionRef.current;
    if (!el) return;
    const compute = () => {
      const rect = el.getBoundingClientRect();
      const norm = ((rect.top + rect.height / 2) - window.innerHeight / 2) / (window.innerHeight * 0.7);
      setHofParallax(Math.max(-1, Math.min(1, norm)) * 22);
    };
    compute();
    window.addEventListener('scroll', compute, { passive: true });
    return () => window.removeEventListener('scroll', compute);
  }, [expanded, hofData]);

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
            backgroundColor: rank <= 3 ? `${theme.primary}22` : 'rgba(0,0,0,0.06)',
            color: rank <= 3 ? theme.primary : '#64748b',
          }}
        >
          {rank}
        </div>

        <PlayerHeadshot playerId={prediction.playerId} playerName={prediction.playerName} size={46} />

        <div className="flex-1 min-w-0">
          <p className="text-slate-900 font-semibold text-sm truncate">{prediction.playerName}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <TeamLogo teamId={prediction.teamId} abbreviation="" size={13} />
            <span className="text-slate-500 text-xs">{prediction.position}</span>
            <span className="text-slate-400 text-xs">·</span>
            {!isPitcher ? (
              prediction.dateWindow === 'season' ? (
                <span className="text-slate-500 text-xs">
                  {stats.avg ? `${stats.avg} AVG` : ''}
                  {stats.homeRuns ? `${stats.avg ? ' · ' : ''}${stats.homeRuns} HR` : ''}
                  {stats.rbi ? ` · ${stats.rbi} RBI` : ''}
                </span>
              ) : (
                <span className="text-slate-500 text-xs">
                  {stats.hits ?? 0}-{stats.atBats ?? 0}
                  {stats.homeRuns ? ` · ${stats.homeRuns} HR` : ''}
                  {stats.rbi ? ` · ${stats.rbi} RBI` : ''}
                </span>
              )
            ) : (
              <span className="text-slate-500 text-xs">
                {prediction.dateWindow === 'season' ? (
                  <>
                    {stats.pitchingStrikeOuts ? `${stats.pitchingStrikeOuts} K` : ''}
                    {stats.inningsPitched ? ` · ${stats.inningsPitched} IP` : ''}
                  </>
                ) : (
                  <>
                    {stats.inningsPitched ?? '0'} IP
                    {stats.pitchingStrikeOuts ? ` · ${stats.pitchingStrikeOuts} K` : ''}
                    {stats.earnedRuns !== undefined ? ` · ${stats.earnedRuns} ER` : ''}
                  </>
                )}
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
            <div className="text-slate-400">
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </div>
          </div>
        </div>
      </div>

      {/* Mini HOF bar — single metallic progress bar, visible on collapsed card */}
      {hofData && !expanded && (() => {
        const metal = metalFor(hofData.probability);
        return (
          <div className="px-3.5 pb-3 -mt-0.5">
            <div className="flex items-center gap-1.5">
              <span style={{ color: metal.main, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>HOF</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#0000000a' }}>
                <div style={{
                  width: `${hofData.probability}%`,
                  height: '100%',
                  background: metal.cssGradient,
                  borderRadius: 9999,
                  transition: 'width 0.8s ease',
                }} />
              </div>
              <span style={{ color: metal.main, fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{hofData.probability}%</span>
            </div>
          </div>
        );
      })()}

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-slate-200 p-4 space-y-4">

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

          {/* ── Hall of Fame Outlook (full) ── */}
          {hofData && (() => {
            const CIRC = 408.407, TRACK = 306.305;
            const fillLen = (hofData.probability / 100) * TRACK;
            const isRate = (unit: string) => ['AVG', 'OPS', 'ERA', 'WHIP'].includes(unit);
            const fmtVal = (v: number, unit: string) =>
              isRate(unit) ? v.toFixed(3).replace(/^0/, '') : Math.round(v).toLocaleString();
            const fmtTarget = (v: number, unit: string) =>
              unit === 'ERA' || unit === 'WHIP' ? v.toFixed(2) : isRate(unit) ? v.toFixed(3).replace(/^0/, '') : v.toLocaleString();
            const metal = metalFor(hofData.probability);
            const gradId = `hofMetal_${prediction.playerId}`;

            return (
              <div ref={hofSectionRef} style={metal.label ? {
                borderRadius: 14,
                padding: 4,
                marginTop: 4,
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
              } : {}}>
                {metal.label && (
                  <div style={{
                    position: 'absolute',
                    top: -30, left: 0, right: 0, bottom: -30,
                    background: metal.sectionBg,
                    transform: `translateY(${hofParallax}px)`,
                    willChange: 'transform',
                  }} />
                )}
                <div style={metal.label ? {
                  background: metal.glassBg,
                  backdropFilter: 'blur(6px) saturate(120%) brightness(1.04)',
                  WebkitBackdropFilter: 'blur(6px) saturate(120%) brightness(1.04)',
                  border: `1px solid ${metal.glassBorder}`,
                  borderRadius: 11,
                  padding: '14px',
                  position: 'relative',
                  zIndex: 1,
                  boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.42), inset 0 -1px 0 rgba(0,0,0,0.10)',
                } : {}}>
                  {metal.label && (
                    <div style={{
                      position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.72), transparent)',
                      pointerEvents: 'none',
                    }} />
                  )}
                {/* Header */}
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={
                  metal.label ? {
                    color: metal.engraveColor,
                    textShadow: metal.engraveShadow,
                    letterSpacing: '0.1em',
                  } : {
                    background: metal.cssGradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }
                }>
                  Hall of Fame Outlook
                </p>

                {/* Gauge + info */}
                <div className="flex items-center gap-4 mb-4">
                  <svg viewBox="0 0 164 140" width={120} height={104} style={{ flexShrink: 0 }}>
                    <defs>
                      <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                        {metal.svgStops.map((s, i) => (
                          <stop key={i} offset={s.offset} stopColor={s.color} />
                        ))}
                      </linearGradient>
                      <linearGradient id={`${gradId}_arc`} x1="0%" y1="100%" x2="100%" y2="0%">
                        {metal.svgStops.map((s, i) => (
                          <stop key={i} offset={s.offset} stopColor={s.color} />
                        ))}
                      </linearGradient>
                    </defs>
                    <circle cx={82} cy={86} r={65} fill="none"
                      stroke={metal.label ? metal.svgTrackColor : '#00000008'} strokeWidth={11}
                      strokeDasharray={`${TRACK} ${CIRC - TRACK}`} strokeLinecap="round"
                      transform="rotate(135 82 86)" />
                    <circle cx={82} cy={86} r={65} fill="none"
                      stroke={`url(#${gradId}_arc)`} strokeWidth={11}
                      strokeDasharray={`${fillLen} ${CIRC - fillLen}`} strokeLinecap="round"
                      transform="rotate(135 82 86)"
                      style={metal.label ? undefined : { filter: `drop-shadow(0 0 6px ${metal.glow})` }} />
                    <text x={82} y={82} textAnchor="middle"
                      fill={metal.label ? metal.svgTextColor : `url(#${gradId})`}
                      fontSize={24} fontWeight="900"
                      fontFamily="-apple-system, BlinkMacSystemFont, sans-serif">
                      {hofData.probability}%
                    </text>
                    <text x={82} y={97} textAnchor="middle"
                      fill={metal.label ? metal.svgSubTextColor : '#9ca3af'}
                      fontSize={8} fontFamily="-apple-system, BlinkMacSystemFont, sans-serif">
                      HOF PROBABILITY
                    </text>
                  </svg>

                  <div className="flex-1 min-w-0">
                    <p style={{
                      fontSize: 13, fontWeight: 700, marginBottom: 4,
                      ...(metal.label
                        ? { color: metal.engraveColor, textShadow: metal.engraveShadow }
                        : { color: metal.main }),
                    }}>
                      {hofData.tier}
                    </p>
                    <p style={{
                      fontSize: 12, lineHeight: 1.5,
                      ...(metal.label
                        ? { color: metal.engraveSubColor, textShadow: metal.engraveShadow }
                        : { color: '#6b7280' }),
                    }}>
                      {hofData.description}
                    </p>
                    {hofData.yearsRemaining > 0 && (
                      <p style={{
                        fontSize: 11, marginTop: 6,
                        ...(metal.label
                          ? { color: metal.engraveSubColor, textShadow: metal.engraveShadow }
                          : { color: '#9ca3af' }),
                      }}>
                        ~{hofData.yearsRemaining}yr{hofData.yearsRemaining !== 1 ? 's' : ''} of career projected
                      </p>
                    )}
                  </div>
                </div>

                {/* Engraved stat rows */}
                <div className="space-y-2.5">
                  {hofData.benchmarks.map((b) => {
                    const showProj = b.higherIsBetter && b.projected > b.current + 1;
                    return (
                      <div key={b.label}>
                        <div className="flex justify-between items-baseline mb-0.5">
                          <div className="flex items-center gap-1.5">
                            <BenchmarkIcon label={b.label} size={12}
                              color={metal.label ? metal.engraveColor : metal.main} />
                            <span style={{
                              fontSize: 12,
                              ...(metal.label
                                ? { color: metal.engraveSubColor, textShadow: metal.engraveShadow }
                                : { color: '#9ca3af' }),
                            }}>
                              {b.label}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span style={{
                              fontSize: 12, fontWeight: 700,
                              ...(metal.label
                                ? { color: metal.engraveColor, textShadow: metal.engraveShadow }
                                : { color: '#374151' }),
                            }}>
                              {fmtVal(b.current, b.unit)}
                            </span>
                            {showProj && (
                              <span style={{
                                fontSize: 10,
                                ...(metal.label
                                  ? { color: metal.engraveSubColor, textShadow: metal.engraveShadow }
                                  : { color: '#9ca3af' }),
                              }}>
                                → {fmtVal(b.projected, b.unit)}
                              </span>
                            )}
                            <span style={{
                              fontSize: 10,
                              ...(metal.label
                                ? { color: metal.engraveSubColor, opacity: 0.7 }
                                : { color: '#c4c4c4' }),
                            }}>
                              / {fmtTarget(b.target, b.unit)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{
                          backgroundColor: metal.label ? metal.grooveTrack : '#00000009',
                          boxShadow: metal.label ? 'inset 0 2px 4px rgba(0,0,0,0.7), inset 0 1px 1px rgba(0,0,0,0.4)' : undefined,
                        }}>
                          <div style={{
                            width: `${Math.min(b.pct, 1) * 100}%`,
                            height: '100%',
                            background: metal.cssGradient,
                            borderRadius: 9999,
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
              </div>
            );
          })()}

        </div>
      )}
    </div>
  );
}
