'use client';

import { useEffect, useState, use, useRef } from 'react';
import { CardPrediction } from '@/types';
import { useTeam } from '@/context/TeamContext';
import TrendingPlayerCard from '@/components/TrendingPlayerCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { ArrowLeft, RefreshCw, Radio, CheckCircle, Flame } from 'lucide-react';
import { useRouter } from 'next/navigation';
import TeamLogo from '@/components/TeamLogo';
import { LiveMatchup } from '@/lib/dummy-game-chc-stl';
import StrikeZone from '@/components/StrikeZone';
import PlayerHeadshot from '@/components/PlayerHeadshot';
import BaseballCardImage from '@/components/BaseballCardImage';

interface TeamInfo {
  id: number;
  name: string;
  abbreviation: string;
  score: number;
}

interface GameData {
  predictions: CardPrediction[];
  awayTeam: TeamInfo;
  homeTeam: TeamInfo;
  isLive: boolean;
  inning: string | null;
  outs?: number;
  liveMatchup?: LiveMatchup;
  playerCount: number;
  error?: string;
}

const EMPTY_TEAM: TeamInfo = { id: 0, name: '—', abbreviation: '—', score: 0 };

// Pitching positions
const PITCHER_POSITIONS = new Set(['SP', 'RP', 'CL', 'CP', 'P']);

function OutsDots({ outs }: { outs: number }) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: i < outs ? '#fbbf24' : '#374151' }}
        />
      ))}
    </div>
  );
}

function ResponsiveCardImage(props: Omit<React.ComponentProps<typeof BaseballCardImage>, 'width' | 'height'>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setDims({ width: w, height: Math.round(w * 1.4) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full" style={{ aspectRatio: '2.5/3.5' }}>
      {dims && <BaseballCardImage {...props} width={dims.width} height={dims.height} />}
    </div>
  );
}

function playerProfileUrl(pred: CardPrediction | undefined, fallbackId: number, fallbackName: string, gameId: string) {
  const id = pred?.playerId ?? fallbackId;
  const params = new URLSearchParams({
    name: pred?.playerName ?? fallbackName,
    teamId: String(pred?.teamId ?? 0),
    position: pred?.position ?? '',
    gameId,
  });
  return `/player/${id}?${params}`;
}

// Events that are positive for the batter (hits + walks)
const BATTER_POSITIVE = new Set([
  'Single', 'Double', 'Triple', 'Home Run', 'Walk', 'Intent Walk', 'Hit By Pitch',
]);

function OutcomeTag({ event, forBatter }: { event: string; forBatter: boolean }) {
  const isGood = forBatter ? BATTER_POSITIVE.has(event) : !BATTER_POSITIVE.has(event);
  const color = isGood ? '#22c55e' : '#ef4444';
  const bg = isGood ? '#22c55e14' : '#ef444414';
  const short = event.replace('Grounded Into DP', 'GIDP').replace('Intent Walk', 'IBB');
  return (
    <span
      className="text-[7px] font-black px-1.5 py-0.5 rounded-full"
      style={{ color, backgroundColor: bg, border: `1px solid ${color}33` }}
    >
      {short}
    </span>
  );
}

function PlayerMatchupCard({
  pred,
  label,
  fallbackName,
  fallbackPlayerId,
  gameId,
  statLine,
  theme,
  router,
  pitchDelta = 0,
  lastDelta = 0,
  outcome,
  forBatter = true,
}: {
  pred: CardPrediction | undefined;
  label: string;
  fallbackName: string;
  fallbackPlayerId: number;
  gameId: string;
  statLine: string;
  theme: import('@/types').TeamTheme;
  router: ReturnType<typeof useRouter>;
  pitchDelta?: number;
  lastDelta?: number;
  outcome?: string;
  forBatter?: boolean;
}) {
  const name = pred?.playerName ?? fallbackName;
  const adjustedPct = (pred?.percentageChange ?? 0) + pitchDelta;
  const isUp = adjustedPct > 0;
  const isDown = adjustedPct < 0;
  const pctColor = isUp ? '#22c55e' : isDown ? '#ef4444' : '#9ca3af';
  const arrow = isUp ? '↑' : isDown ? '↓' : '·';
  const signedPct = `${isUp ? '+' : ''}${adjustedPct.toFixed(1)}%`;
  const lastDeltaColor = lastDelta >= 0 ? '#4ade80' : '#f87171';
  const lastDeltaStr = lastDelta !== 0
    ? `${lastDelta > 0 ? '+' : ''}${lastDelta.toFixed(1)}`
    : null;

  return (
    <button
      className="w-full rounded-xl p-1.5 flex flex-col items-center gap-1.5 text-center border border-white/8 active:opacity-75 transition-opacity"
      style={{ backgroundColor: '#07111f' }}
      onClick={() => router.push(playerProfileUrl(pred, fallbackPlayerId, fallbackName, gameId))}
    >
      <span className="text-[7px] font-bold uppercase tracking-widest text-gray-500">{label}</span>

      <PlayerHeadshot playerId={pred?.playerId ?? fallbackPlayerId} playerName={name} size={40} />

      <p className="text-white text-[9px] font-black leading-tight w-full truncate">{name}</p>

      <div
        className="w-full px-1 py-1 rounded-lg"
        style={{ backgroundColor: `${pctColor}15` }}
      >
        <p className="font-black text-xs leading-none" style={{ color: pctColor }}>
          {arrow} {signedPct}
        </p>
        {lastDeltaStr && (
          <p className="text-[7px] mt-0.5 leading-none font-semibold" style={{ color: lastDeltaColor }}>
            {lastDelta > 0 ? '▲' : '▼'} {lastDeltaStr} pitch
          </p>
        )}
      </div>
      {outcome && <OutcomeTag event={outcome} forBatter={forBatter} />}
    </button>
  );
}

function BasesDiamond({ bases }: { bases: LiveMatchup['bases'] }) {
  const lit = '#f59e0b';
  const dim = '#1f2937';
  const stroke = '#374151';
  // Diamond layout: 2B top, 1B right, 3B left, home bottom (display only 1B/2B/3B)
  return (
    <svg viewBox="0 0 64 56" width={64} height={56} aria-label="bases">
      {/* 2B — top center */}
      <rect
        x={24} y={2} width={16} height={16} rx={3}
        fill={bases.second ? lit : dim} stroke={stroke} strokeWidth={1.2}
        transform="rotate(45 32 10)"
      />
      {/* 3B — left */}
      <rect
        x={4} y={22} width={16} height={16} rx={3}
        fill={bases.third ? lit : dim} stroke={stroke} strokeWidth={1.2}
        transform="rotate(45 12 30)"
      />
      {/* 1B — right */}
      <rect
        x={44} y={22} width={16} height={16} rx={3}
        fill={bases.first ? lit : dim} stroke={stroke} strokeWidth={1.2}
        transform="rotate(45 52 30)"
      />
      {/* Home plate — bottom (always white, indicator only) */}
      <polygon
        points="32,52 25,44 25,38 39,38 39,44"
        fill="#e5e7eb" stroke={stroke} strokeWidth={1.2}
      />
    </svg>
  );
}

function CountDots({ count, max, activeColor }: { count: number; max: number; activeColor: string }) {
  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className="w-3 h-3 rounded-full border"
          style={{
            backgroundColor: i < count ? activeColor : 'transparent',
            borderColor: i < count ? activeColor : '#374151',
          }}
        />
      ))}
    </div>
  );
}

function MatchupStrip({ matchup }: { matchup: LiveMatchup }) {
  const { batter, pitcher } = matchup;
  return (
    <div
      className="mt-3 pt-3 border-t border-white/8 flex items-center gap-3"
    >
      {/* Batter */}
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">At Bat</p>
        <p className="text-white text-xs font-black leading-tight truncate">
          #{batter.number} {batter.name}
        </p>
        <p className="text-gray-400 text-[10px] leading-snug">
          {batter.hitsToday}-{batter.atBatsToday} · AVG {batter.seasonAvg}
        </p>
      </div>

      {/* Count */}
      <div className="flex flex-col items-center gap-1.5 flex-shrink-0 px-1">
        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Count</p>
        <CountDots count={pitcher.balls} max={4} activeColor="#22c55e" />
        <CountDots count={pitcher.strikes} max={3} activeColor="#ef4444" />
        <p className="text-[8px] text-gray-600 mt-0.5">B · S</p>
      </div>

      {/* Pitcher */}
      <div className="flex-1 min-w-0 text-right">
        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Pitching</p>
        <p className="text-white text-xs font-black leading-tight truncate">
          #{pitcher.number} {pitcher.name}
        </p>
        <p className="text-gray-400 text-[10px] leading-snug">
          ERA {pitcher.seasonEra} · {pitcher.pitchCount}p
        </p>
      </div>
    </div>
  );
}

export default function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const { theme } = useTeam();
  const router = useRouter();

  const [data, setData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSide, setSelectedSide] = useState<'away' | 'home'>('away');
  // Fast live-only state — updated every 5s without re-fetching predictions
  const [liveSnap, setLiveSnap] = useState<{
    liveMatchup?: LiveMatchup;
    inning?: string | null;
    outs?: number;
    awayScore?: number;
    homeScore?: number;
  } | null>(null);

  async function fetchGame() {
    try {
      const res = await fetch(`/api/game/${gameId}`);
      const json = await res.json() as GameData;
      setData(json);
    } catch {
      setData({
        predictions: [],
        awayTeam: EMPTY_TEAM,
        homeTeam: EMPTY_TEAM,
        isLive: false,
        inning: null,
        playerCount: 0,
        error: 'Failed to load game data',
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchLive() {
    try {
      const res = await fetch(`/api/game/${gameId}/live`);
      if (res.ok) setLiveSnap(await res.json());
    } catch { /* silently skip */ }
  }

  useEffect(() => {
    fetchGame();
    fetchLive();
    // Full predictions refresh every 30s; live matchup every 5s
    const fullInterval = setInterval(fetchGame, 30_000);
    const liveInterval = setInterval(fetchLive, 5_000);
    return () => { clearInterval(fullInterval); clearInterval(liveInterval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const predictions = data?.predictions ?? [];
  const isLive = data?.isLive ?? false;
  // Prefer live-snap scores/inning/matchup when available (updated every 5s)
  const awayTeam = { ...(data?.awayTeam ?? EMPTY_TEAM), score: liveSnap?.awayScore ?? data?.awayTeam?.score ?? 0 };
  const homeTeam = { ...(data?.homeTeam ?? EMPTY_TEAM), score: liveSnap?.homeScore ?? data?.homeTeam?.score ?? 0 };
  const outs = liveSnap?.outs ?? data?.outs ?? 0;
  const liveMatchup = liveSnap?.liveMatchup ?? data?.liveMatchup;

  const selectedTeamId = selectedSide === 'away' ? awayTeam.id : homeTeam.id;
  const sidePredictions = predictions.filter(p => p.teamId === selectedTeamId);

  // Split into lineup (position players) and pitchers
  const lineup  = sidePredictions
    .filter(p => !PITCHER_POSITIONS.has(p.position))
    .sort((a, b) => Math.abs(b.predictionScore) - Math.abs(a.predictionScore));
  const pitchers = sidePredictions
    .filter(p => PITCHER_POSITIONS.has(p.position))
    .sort((a, b) => Math.abs(b.predictionScore) - Math.abs(a.predictionScore));

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0f1e' }}>
      {/* Header */}
      <div
        className="px-4 pt-12 pb-4"
        style={{ background: `linear-gradient(180deg, ${theme.primary}33 0%, transparent 100%)` }}
      >
        {/* Nav row */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl border border-white/10 text-gray-400"
            style={{ backgroundColor: theme.cardBackground }}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            {isLive ? (
              <div className="flex items-center gap-1.5 mb-0.5">
                <Radio size={11} className="text-green-400 animate-pulse" />
                <span className="text-green-400 text-[11px] font-bold tracking-wider">LIVE</span>
                {data?.inning && (
                  <span className="text-gray-400 text-[11px] ml-1">{data.inning}</span>
                )}
                {isLive && typeof outs === 'number' && (
                  <span className="ml-2">
                    <OutsDots outs={outs} />
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mb-0.5">
                <CheckCircle size={11} className="text-gray-500" />
                <span className="text-gray-500 text-[11px] font-bold tracking-wider">FINAL</span>
              </div>
            )}
            <h1 className="text-base font-bold text-white leading-tight truncate">
              {awayTeam.abbreviation} vs {homeTeam.abbreviation}
            </h1>
          </div>
          <button
            onClick={() => { setLoading(true); fetchGame(); }}
            className="p-2 rounded-xl border border-white/10 text-gray-400"
            style={{ backgroundColor: theme.cardBackground }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Scoreboard */}
        {!loading && (
          <div
            className="rounded-2xl p-4 border border-white/10"
            style={{ backgroundColor: theme.cardBackground }}
          >
            <div className="flex items-center justify-between">
              {/* Away team */}
              <div className="flex items-center gap-3">
                <TeamLogo teamId={awayTeam.id} abbreviation={awayTeam.abbreviation} size={46} />
                <div>
                  <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide">Away</p>
                  <p className="text-white text-sm font-bold leading-tight">{awayTeam.abbreviation}</p>
                  <p className="text-white text-2xl font-black tabular-nums leading-none mt-0.5">
                    {awayTeam.score}
                  </p>
                </div>
              </div>

              {/* Center — inning + outs */}
              <div className="flex flex-col items-center gap-1.5">
                {isLive && data?.inning ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-white text-xs font-black tabular-nums">{data.inning}</span>
                    <OutsDots outs={outs} />
                    <span className="text-gray-600 text-[9px] uppercase tracking-wider">{outs} out{outs !== 1 ? 's' : ''}</span>
                  </>
                ) : (
                  <span className="text-gray-600 text-sm font-bold">—</span>
                )}
              </div>

              {/* Home team */}
              <div className="flex items-center gap-3 flex-row-reverse">
                <TeamLogo teamId={homeTeam.id} abbreviation={homeTeam.abbreviation} size={46} />
                <div className="text-right">
                  <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide">Home</p>
                  <p className="text-white text-sm font-bold leading-tight">{homeTeam.abbreviation}</p>
                  <p className="text-white text-2xl font-black tabular-nums leading-none mt-0.5">
                    {homeTeam.score}
                  </p>
                </div>
              </div>
            </div>

            {/* Live batter / pitcher matchup strip */}
            {isLive && liveMatchup && <MatchupStrip matchup={liveMatchup} />}

            {/* Batter card | Strike zone | Pitcher card */}
            {isLive && liveMatchup && (() => {
              const batterPred = predictions.find(p => p.playerId === liveMatchup.batterId);
              const pitcherPred = predictions.find(p => p.playerId === liveMatchup.pitcherId);
              const pitches = liveMatchup.pitches ?? [];

              // Micro-deltas: balls favour batter, strikes favour pitcher
              let batterDelta = 0, pitcherDelta = 0;
              for (const p of pitches) {
                if (p.result === 'ball') { batterDelta += 0.3; pitcherDelta -= 0.2; }
                else if (p.result === 'called_strike' || p.result === 'swinging_strike') { batterDelta -= 0.3; pitcherDelta += 0.2; }
              }
              batterDelta  = Math.round(batterDelta  * 10) / 10;
              pitcherDelta = Math.round(pitcherDelta * 10) / 10;

              const last = pitches[pitches.length - 1];
              const batterLast  = !last ? 0 : last.result === 'ball' ? 0.3 : (last.result === 'called_strike' || last.result === 'swinging_strike') ? -0.3 : 0;
              const pitcherLast = !last ? 0 : last.result === 'ball' ? -0.2 : (last.result === 'called_strike' || last.result === 'swinging_strike') ? 0.2 : 0;

              return (
                <div className="mt-3 pt-3 border-t border-white/8">
                  <div className="flex gap-1.5 items-stretch">
                    <div className="flex-[1] flex flex-col gap-1.5">
                      <PlayerMatchupCard
                        pred={batterPred}
                        label="At Bat"
                        fallbackName={liveMatchup.batter.name}
                        fallbackPlayerId={liveMatchup.batterId}
                        gameId={gameId}
                        statLine=""
                        theme={theme}
                        router={router}
                        pitchDelta={batterDelta}
                        lastDelta={batterLast}
                        outcome={liveMatchup.lastResult?.event}
                        forBatter={true}
                      />
                      <button
                        className="w-full relative overflow-hidden rounded-xl active:opacity-75 transition-opacity"
                        onClick={() => router.push(playerProfileUrl(batterPred, liveMatchup.batterId, liveMatchup.batter.name, gameId))}
                      >
                        <ResponsiveCardImage
                          playerId={batterPred?.playerId ?? 0}
                          playerName={batterPred?.playerName ?? liveMatchup.batter.name}
                          teamId={batterPred?.teamId ?? 0}
                          position={batterPred?.position ?? 'OF'}
                          cardType="Rookie Card"
                          cardYear={batterPred?.rookieCardOptions?.[0]?.year}
                          cardSet={batterPred?.rookieCardOptions?.[0]?.set}
                          ebayImageUrl={batterPred?.priceSummary?.activeListing?.imageUrl}
                        />
                        <div
                          className="absolute inset-x-0 bottom-0 flex items-end justify-center pb-1.5"
                          style={{ height: '45%', background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)', pointerEvents: 'none', zIndex: 20 }}
                        >
                          <span className="px-2 py-0.5 rounded-full text-[7px] font-black text-white" style={{ backgroundColor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)' }}>
                            Buy Now
                          </span>
                        </div>
                      </button>
                    </div>
                    <div className="flex-[3] flex flex-col">
                      <div className="mt-auto flex flex-col items-center gap-1.5 w-full">
                        <BasesDiamond bases={liveMatchup.bases} />
                        <StrikeZone pitches={liveMatchup.pitches} compact />
                      </div>
                    </div>
                    <div className="flex-[1] flex flex-col gap-1.5">
                      <PlayerMatchupCard
                        pred={pitcherPred}
                        label="Pitching"
                        fallbackName={liveMatchup.pitcher.name}
                        fallbackPlayerId={liveMatchup.pitcherId}
                        gameId={gameId}
                        statLine=""
                        theme={theme}
                        router={router}
                        pitchDelta={pitcherDelta}
                        lastDelta={pitcherLast}
                        outcome={liveMatchup.lastResult?.event}
                        forBatter={false}
                      />
                      <button
                        className="w-full relative overflow-hidden rounded-xl active:opacity-75 transition-opacity"
                        onClick={() => router.push(playerProfileUrl(pitcherPred, liveMatchup.pitcherId, liveMatchup.pitcher.name, gameId))}
                      >
                        <ResponsiveCardImage
                          playerId={pitcherPred?.playerId ?? 0}
                          playerName={pitcherPred?.playerName ?? liveMatchup.pitcher.name}
                          teamId={pitcherPred?.teamId ?? 0}
                          position={pitcherPred?.position ?? 'P'}
                          cardType="Rookie Card"
                          cardYear={pitcherPred?.rookieCardOptions?.[0]?.year}
                          cardSet={pitcherPred?.rookieCardOptions?.[0]?.set}
                          ebayImageUrl={pitcherPred?.priceSummary?.activeListing?.imageUrl}
                        />
                        <div
                          className="absolute inset-x-0 bottom-0 flex items-end justify-center pb-1.5"
                          style={{ height: '45%', background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)', pointerEvents: 'none', zIndex: 20 }}
                        >
                          <span className="px-2 py-0.5 rounded-full text-[7px] font-black text-white" style={{ backgroundColor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)' }}>
                            Buy Now
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-4 justify-center mt-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#ef444418', border: '1px solid #ef4444' }} />
                      <span className="text-[9px] text-gray-500">Strike</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#22c55e18', border: '1px solid #22c55e' }} />
                      <span className="text-[9px] text-gray-500">Ball</span>
                    </div>
                  </div>

                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="px-4">
        {/* Team toggle */}
        {!loading && !data?.error && (
          <div
            className="flex rounded-2xl overflow-hidden border border-white/10 mb-4"
            style={{ backgroundColor: theme.cardBackground }}
          >
            {(['away', 'home'] as const).map(side => {
              const team = side === 'away' ? awayTeam : homeTeam;
              const active = selectedSide === side;
              const count = predictions.filter(p => p.teamId === team.id).length;
              return (
                <button
                  key={side}
                  onClick={() => setSelectedSide(side)}
                  className="flex-1 flex items-center justify-center gap-2.5 py-3 transition-all"
                  style={{
                    backgroundColor: active ? `${theme.primary}22` : 'transparent',
                    borderBottom: active ? `2px solid ${theme.primary}` : '2px solid transparent',
                  }}
                >
                  <TeamLogo teamId={team.id} abbreviation={team.abbreviation} size={24} />
                  <div className="text-left">
                    <p className="text-white text-xs font-bold leading-tight">{team.name}</p>
                    <p className="text-gray-500 text-[10px] leading-tight capitalize">
                      {side} · {count} players
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {loading && <LoadingSpinner message="Loading live roster & card data..." />}

        {data?.error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {data.error}
          </div>
        )}

        {/* Who's Hot */}
        {!loading && !data?.error && (() => {
          const hot = [...sidePredictions]
            .filter(p => p.percentageChange > 0)
            .sort((a, b) => b.percentageChange - a.percentageChange)
            .slice(0, 3);
          if (hot.length === 0) return null;
          return (
            <>
              <div className="flex items-center gap-1.5 mb-3">
                <Flame size={12} style={{ color: theme.primary }} />
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Who&apos;s Hot
                </p>
              </div>
              <div className="flex gap-2 mb-6">
                {hot.map(p => (
                  <button
                    key={p.playerId}
                    className="flex-1 flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border border-white/8 active:opacity-75 transition-opacity"
                    style={{ backgroundColor: theme.cardBackground }}
                    onClick={() => router.push(`/player/${p.playerId}?name=${encodeURIComponent(p.playerName)}&teamId=${p.teamId}&position=${encodeURIComponent(p.position)}&gameId=${gameId}`)}
                  >
                    <PlayerHeadshot playerId={p.playerId} playerName={p.playerName} size={46} />
                    <div className="text-center w-full min-w-0">
                      <p className="text-white text-[9px] font-black leading-tight truncate">
                        {p.playerName.split(' ').slice(-1)[0]}
                      </p>
                      <p className="text-gray-500 text-[8px] mt-0.5">{p.position}</p>
                    </div>
                    <div className="w-full px-1 py-1 rounded-lg" style={{ backgroundColor: '#22c55e12' }}>
                      <p className="text-[10px] font-black text-center" style={{ color: '#22c55e' }}>
                        ↑ +{p.percentageChange.toFixed(1)}%
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          );
        })()}

        {/* Lineup */}
        {!loading && lineup.length > 0 && (
          <>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
              Lineup · {lineup.length} players
            </p>
            <div className="space-y-3 mb-6">
              {lineup.map((prediction, i) => (
                <TrendingPlayerCard
                  key={prediction.playerId}
                  prediction={prediction}
                  rank={i + 1}
                  defaultChartView="game"
                  isLive={isLive}
                />
              ))}
            </div>
          </>
        )}

        {/* Pitchers */}
        {!loading && pitchers.length > 0 && (
          <>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
              Pitchers · {pitchers.length} arms
            </p>
            <div className="space-y-3 pb-8">
              {pitchers.map((prediction, i) => (
                <TrendingPlayerCard
                  key={prediction.playerId}
                  prediction={prediction}
                  rank={i + 1}
                  defaultChartView="game"
                  isLive={isLive}
                />
              ))}
            </div>
          </>
        )}

        {!loading && sidePredictions.length === 0 && !data?.error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <p className="text-2xl">⚾</p>
            <p className="text-white font-semibold">No player data yet</p>
            <p className="text-gray-400 text-sm">Game may not have started or no active lineup found</p>
          </div>
        )}
      </div>
    </div>
  );
}
