'use client';

import { useEffect, useState } from 'react';
import { CardPrediction } from '@/types';
import { useTeam } from '@/context/TeamContext';
import { useWatchList } from '@/context/WatchListContext';
import TrendingPlayerCard from '@/components/TrendingPlayerCard';
import PlayerHeadshot from '@/components/PlayerHeadshot';
import TeamLogo from '@/components/TeamLogo';
import { Star, X, Bell, BellOff, FlaskConical, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useLiveEvents } from '@/context/LiveEventsContext';
import { PlayEventType, getEventEmoji, getEventLabel } from '@/lib/play-detector';
import { getEventNotificationTier, TIER_CONFIGS } from '@/lib/notification-tiers';

interface TrendingResponse {
  predictions: CardPrediction[];
  usedDummy: boolean;
  teamGameStatuses: Record<number, 'live' | 'final' | 'scheduled'>;
  teamGameTimes: Record<number, string>;
}

function formatGameTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function WatchlistPage() {
  const { theme } = useTeam();
  const { watchedPlayers, toggleWatch } = useWatchList();
  const { fireTestEvent, pushStatus, subscribeToPush } = useLiveEvents();
  const [testOpen, setTestOpen] = useState(false);
  const [testPlayerId, setTestPlayerId] = useState<number | null>(null);
  const [trendingPredictions, setTrendingPredictions] = useState<CardPrediction[]>([]);
  const [teamGameStatuses, setTeamGameStatuses] = useState<Record<number, 'live' | 'final' | 'scheduled'>>({});
  const [teamGameTimes, setTeamGameTimes] = useState<Record<number, string>>({});
  const [loadingTrending, setLoadingTrending] = useState(false);

  useEffect(() => {
    if (watchedPlayers.length === 0) return;
    setLoadingTrending(true);
    fetch('/api/trending')
      .then(r => r.json())
      .then((data: TrendingResponse) => {
        setTrendingPredictions(data.predictions ?? []);
        setTeamGameStatuses(data.teamGameStatuses ?? {});
        setTeamGameTimes(data.teamGameTimes ?? {});
      })
      .catch(() => {})
      .finally(() => setLoadingTrending(false));
  }, [watchedPlayers.length]);

  const watchedIds = new Set(watchedPlayers.map(p => p.playerId));

  // Bucket 1: Playing Now — watched players whose team has a Live game + has card prediction data
  const playingNow = trendingPredictions.filter(
    p => watchedIds.has(p.playerId) && teamGameStatuses[p.teamId] === 'live'
  );

  // Bucket 2a: Playing Today (Final) — watched players with stats from a completed game today
  const playingTodayFinal = trendingPredictions.filter(
    p => watchedIds.has(p.playerId) && teamGameStatuses[p.teamId] !== 'live'
  );

  // Bucket 2b: Playing Today (Scheduled) — watched players whose game hasn't started yet
  const predictedIds = new Set(trendingPredictions.map(p => p.playerId));
  const playingTodayScheduled = watchedPlayers.filter(
    p => !predictedIds.has(p.playerId) && teamGameStatuses[p.teamId] === 'scheduled'
  );

  // Bucket 3: Not Playing Today — no game at all
  const notPlayingToday = watchedPlayers.filter(
    p => !predictedIds.has(p.playerId) && !teamGameStatuses[p.teamId]
  );

  const hasPlayingToday = playingTodayFinal.length > 0 || playingTodayScheduled.length > 0;
  const hasAny = watchedPlayers.length > 0;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div
        className="px-4 pt-12 pb-4"
        style={{ background: `linear-gradient(180deg, ${theme.primary}33 0%, transparent 100%)` }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <Star size={22} style={{ color: theme.primary }} fill={theme.primary} />
            <h1 className="text-xl font-black text-slate-900">Watchlist</h1>
          </div>
          {pushStatus === 'unsubscribed' && hasAny && (
            <button
              onClick={() => subscribeToPush()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 text-slate-500"
              style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
            >
              <Bell size={12} />
              Enable alerts
            </button>
          )}
          {pushStatus === 'subscribed' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-green-400"
                 style={{ backgroundColor: '#22c55e18' }}>
              <Bell size={12} />
              Alerts on
            </div>
          )}
          {pushStatus === 'denied' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600">
              <BellOff size={12} />
              Alerts off
            </div>
          )}
        </div>
        <p className="text-gray-500 text-sm pl-9">
          {hasAny
            ? `${watchedPlayers.length} player${watchedPlayers.length !== 1 ? 's' : ''} followed`
            : 'No players followed yet'}
        </p>
      </div>

      <div className="px-4 space-y-6 pb-8">
        {/* Empty state */}
        {!hasAny && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${theme.primary}22` }}
            >
              <Star size={28} style={{ color: theme.primary }} />
            </div>
            <div>
              <p className="text-slate-900 font-semibold text-base">No players followed</p>
              <p className="text-gray-500 text-sm mt-1">
                Tap the ★ next to any player to add them here
              </p>
            </div>
          </div>
        )}

        {/* Loading shimmer */}
        {loadingTrending && watchedPlayers.length > 0 && playingNow.length === 0 && !hasPlayingToday && (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ backgroundColor: theme.cardBackground }} />
            ))}
          </div>
        )}

        {/* ── Section 1: Playing Now ───────────────────────────────────────── */}
        {playingNow.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <p className="text-xs font-bold text-green-400 uppercase tracking-wider">Playing Now</p>
            </div>
            <div className="space-y-3">
              {playingNow.map((prediction, i) => (
                <TrendingPlayerCard
                  key={prediction.playerId}
                  prediction={prediction}
                  rank={i + 1}
                  defaultChartView="game"
                  isLive={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Section 2: Playing Today ─────────────────────────────────────── */}
        {hasPlayingToday && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.primary }} />
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.primary }}>
                Playing Today
              </p>
            </div>
            <div className="space-y-3">
              {/* Players with stats (Final games) */}
              {playingTodayFinal.map((prediction, i) => (
                <div key={prediction.playerId} className="relative">
                  <TrendingPlayerCard
                    prediction={prediction}
                    rank={playingNow.length + i + 1}
                    defaultChartView="game"
                    isLive={false}
                  />
                  {/* Final badge */}
                  <div
                    className="absolute top-3 right-10 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: '#475569' }}
                  >
                    Final
                  </div>
                </div>
              ))}

              {/* Players with scheduled games (no stats yet) */}
              {playingTodayScheduled.map(player => {
                const gameTime = teamGameTimes[player.teamId];
                return (
                  <div
                    key={player.playerId}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200"
                    style={{ backgroundColor: theme.cardBackground }}
                  >
                    <PlayerHeadshot playerId={player.playerId} playerName={player.playerName} size={42} />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 font-semibold text-sm truncate">{player.playerName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <TeamLogo teamId={player.teamId} abbreviation="" size={12} />
                        <span className="text-gray-500 text-xs">{player.position}</span>
                        {gameTime && (
                          <>
                            <span className="text-gray-700 text-xs">·</span>
                            <Clock size={10} className="text-gray-500" />
                            <span className="text-gray-500 text-xs">{formatGameTime(gameTime)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleWatch(player)}
                      className="p-2 rounded-xl text-gray-500 hover:text-red-400 transition-colors"
                      style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
                      aria-label="Remove from watchlist"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Simulate Events (dev panel) ─────────────────────────────────── */}
        {hasAny && (
          <div className="rounded-2xl border border-slate-200 overflow-hidden" style={{ backgroundColor: theme.cardBackground }}>
            <button
              onClick={() => setTestOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <FlaskConical size={14} className="text-purple-400" />
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Simulate Events</span>
              </div>
              {testOpen ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
            </button>

            {testOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
                {/* Player picker */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">Fire for player:</p>
                  <div className="flex flex-wrap gap-2">
                    {watchedPlayers.map(p => (
                      <button
                        key={p.playerId}
                        onClick={() => setTestPlayerId(p.playerId)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                        style={{
                          backgroundColor: testPlayerId === p.playerId ? '#a855f7' : '#ffffff12',
                          color: testPlayerId === p.playerId ? '#fff' : '#9ca3af',
                        }}
                      >
                        {p.playerName.split(' ').pop()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Event buttons */}
                {(() => {
                  const EVENT_GROUPS: { label: string; color: string; events: PlayEventType[] }[] = [
                    {
                      label: 'Awards & Milestones',
                      color: '#fbbf24',
                      events: ['world_series_win', 'mvp_award', 'cy_young_award', 'hr_milestone_50', 'rookie_of_year'],
                    },
                    {
                      label: 'Hitter — Specialty',
                      color: '#4ade80',
                      events: ['cycle', 'walk_off_hr', 'grand_slam', 'multi_hr_game', 'five_rbi_game', 'inside_park_hr'],
                    },
                    {
                      label: 'Hitter — Standard',
                      color: '#4ade80',
                      events: ['home_run', 'triple', 'stolen_base', 'double', 'single'],
                    },
                    {
                      label: 'Pitcher',
                      color: '#818cf8',
                      events: ['perfect_game', 'no_hitter', 'pitcher_k_15plus', 'cg_shutout'],
                    },
                    {
                      label: 'Negative — Injury / Roster',
                      color: '#ef4444',
                      events: ['season_ending_injury', 'il_60_day', 'suspension', 'il_15_day', 'dfa'],
                    },
                    {
                      label: 'Negative — In-Game',
                      color: '#f87171',
                      events: ['double_play', 'strikeout', 'groundout', 'flyout'],
                    },
                  ];

                  const player = watchedPlayers.find(p => p.playerId === (testPlayerId ?? watchedPlayers[0]?.playerId));
                  const fire = (evt: PlayEventType) => { if (player) fireTestEvent(player.playerId, player.playerName, evt); };

                  const TIER_META: Record<number, { bg: string; text: string; label: string }> = {
                    1: { bg: '#f59e0b22', text: '#f59e0b', label: 'T1 Full Screen' },
                    2: { bg: '#3b82f622', text: '#60a5fa', label: 'T2 Overlay' },
                    3: { bg: '#8b5cf622', text: '#a78bfa', label: 'T3 Toast' },
                    4: { bg: '#ffffff0e', text: '#6b7280', label: 'T4 Log' },
                  };

                  const EventBtn = ({ evt, groupColor }: { evt: PlayEventType; groupColor: string }) => {
                    const tier = getEventNotificationTier(evt);
                    const tm = TIER_META[tier];
                    return (
                      <button
                        onClick={() => fire(evt)}
                        className="flex flex-col gap-1.5 px-3 py-2.5 rounded-xl text-left transition-opacity hover:opacity-75 active:scale-95 w-full"
                        style={{ backgroundColor: `${groupColor}10`, border: `1px solid ${groupColor}20` }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-base leading-none flex-shrink-0">{getEventEmoji(evt)}</span>
                          <span className="text-xs font-bold leading-tight" style={{ color: groupColor }}>
                            {getEventLabel(evt)}
                          </span>
                        </div>
                        <span
                          className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded self-start"
                          style={{ backgroundColor: tm.bg, color: tm.text }}
                        >
                          {TIER_CONFIGS[tier].icon} {tm.label}
                        </span>
                      </button>
                    );
                  };

                  return (
                    <div className="space-y-4">
                      {EVENT_GROUPS.map(group => (
                        <div key={group.label}>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: group.color }}>
                            {group.label}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {group.events.map(evt => <EventBtn key={evt} evt={evt} groupColor={group.color} />)}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── Section 3: Not Playing Today ─────────────────────────────────── */}
        {notPlayingToday.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Not Playing Today
            </p>
            <div className="space-y-2">
              {notPlayingToday.map(player => (
                <div
                  key={player.playerId}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200"
                  style={{ backgroundColor: theme.cardBackground }}
                >
                  <PlayerHeadshot playerId={player.playerId} playerName={player.playerName} size={42} />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 font-semibold text-sm truncate">{player.playerName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <TeamLogo teamId={player.teamId} abbreviation="" size={12} />
                      <span className="text-gray-500 text-xs">{player.position}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleWatch(player)}
                    className="p-2 rounded-xl text-gray-500 hover:text-red-400 transition-colors"
                    style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
                    aria-label="Remove from watchlist"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
