'use client';

import { useEffect, useRef, useState } from 'react';
import { CardPrediction } from '@/types';
import { useTeam } from '@/context/TeamContext';
import { useGrading } from '@/context/GradingContext';
import TrendingPlayerCard from '@/components/TrendingPlayerCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import TeamLogo from '@/components/TeamLogo';
import { ALL_TEAMS } from '@/lib/team-themes';
import { RefreshCw, TrendingUp, TrendingDown, Users, Globe, Search, X, Star } from 'lucide-react';
import Link from 'next/link';
import { useWatchList } from '@/context/WatchListContext';
import PlayerHeadshot from '@/components/PlayerHeadshot';

type Scope = 'overall' | 'myteam';
type DateWindow = 'day' | 'week' | 'month' | 'season';

interface PlayerResult {
  id: number;
  fullName: string;
  currentTeam?: { id: number; name: string };
  primaryPosition?: { name: string; abbreviation: string };
}

const WINDOW_LABELS: Record<DateWindow, string> = {
  day: 'Day', week: 'Week', month: 'Month', season: 'Season',
};

export default function TrendingPage() {
  const { theme, selectedTeamId } = useTeam();
  const { companyId, gradeValue } = useGrading();
  const { isWatched, toggleWatch } = useWatchList();
  const [predictions, setPredictions] = useState<CardPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameCount, setGameCount] = useState(0);
  const [usedDummy, setUsedDummy] = useState(false);
  const [error, setError] = useState('');
  const [scope, setScope] = useState<Scope>('overall');
  const [dateWindow, setDateWindow] = useState<DateWindow>('day');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [mlbResults, setMlbResults] = useState<PlayerResult[]>([]);
  const [mlbSearching, setMlbSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedTeam = ALL_TEAMS.find(t => t.id === selectedTeamId);

  async function fetchTrending(window: DateWindow = dateWindow) {
    try {
      setError('');
      const params = new URLSearchParams({ window });
      if (companyId) { params.set('grading', companyId); if (gradeValue) params.set('grade', gradeValue); }
      const res = await fetch(`/api/trending?${params}`);
      const data = await res.json() as {
        predictions: CardPrediction[]; gameCount: number;
        usedDummy?: boolean; error?: string;
      };
      if (data.error && !data.predictions?.length) {
        setError(data.error);
      } else {
        const seen = new Set<number>();
        const deduped = (data.predictions ?? []).filter(p => {
          if (seen.has(p.playerId)) return false;
          seen.add(p.playerId);
          return true;
        });
        setPredictions(deduped);
        setGameCount(data.gameCount ?? 0);
        setUsedDummy(data.usedDummy ?? false);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleWindowChange(w: DateWindow) {
    setDateWindow(w);
    setLoading(true);
    fetchTrending(w);
  }

  useEffect(() => {
    setLoading(true);
    fetchTrending(dateWindow);
    // Only auto-refresh on the day view — historical windows are stable
    if (dateWindow !== 'day') return;
    const interval = setInterval(() => fetchTrending('day'), 120_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, gradeValue, dateWindow]);

  // Search: filter trending list + MLB-wide fallback
  const trendingMatch = searchQuery.length > 0
    ? predictions.filter(p => p.playerName.toLowerCase().includes(searchQuery.toLowerCase()))
    : predictions;

  useEffect(() => {
    if (searchQuery.length < 2) { setMlbResults([]); return; }
    setMlbSearching(true);
    const t = setTimeout(() => {
      const trendingIds = new Set(trendingMatch.map(p => p.playerId));
      fetch(`/api/players/search?q=${encodeURIComponent(searchQuery)}`)
        .then(r => r.json())
        .then((d: { people: PlayerResult[] }) =>
          setMlbResults((d.people ?? []).filter(p => !trendingIds.has(p.id)))
        )
        .catch(() => {})
        .finally(() => setMlbSearching(false));
    }, 350);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Apply scope filter
  const scoped = scope === 'myteam' && selectedTeamId
    ? trendingMatch.filter(p => p.teamId === selectedTeamId)
    : trendingMatch;

  const rising = scoped.filter(p => p.direction === 'up');
  const falling = scoped.filter(p => p.direction === 'down');

  const totalRising = predictions.filter(p => p.direction === 'up').length;
  const totalFalling = predictions.filter(p => p.direction === 'down').length;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-4 pt-12 pb-3" style={{ background: `linear-gradient(180deg, ${theme.primary}33 0%, transparent 100%)` }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Trending</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {usedDummy
                ? 'Featured players · tap to expand'
                : dateWindow === 'day' && gameCount > 0
                  ? `Live across ${gameCount} game${gameCount !== 1 ? 's' : ''} · tap to expand`
                  : dateWindow === 'week'
                    ? `Last 7 days · ${gameCount} games`
                    : dateWindow === 'month'
                      ? `Last 30 days · ${gameCount} games`
                      : dateWindow === 'season'
                        ? `${new Date().getFullYear()} season leaders`
                        : 'Tap any player to expand'}
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); fetchTrending(); }}
            className="p-2 rounded-xl border border-slate-200 text-slate-500"
            style={{ backgroundColor: theme.cardBackground }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Search bar */}
        <div className="relative mb-3">
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search any player…"
            style={{
              width: '100%', padding: '10px 36px', borderRadius: 12,
              border: '1px solid #e2e8f0', fontSize: 14, color: '#0f172a',
              background: 'rgba(255,255,255,0.9)', outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', padding: 4 }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Date window filter */}
        <div
          className="flex rounded-xl p-1 gap-0.5 mb-2"
          style={{ backgroundColor: theme.cardBackground }}
        >
          {(Object.keys(WINDOW_LABELS) as DateWindow[]).map(w => (
            <button
              key={w}
              onClick={() => handleWindowChange(w)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                backgroundColor: dateWindow === w ? theme.primary : 'transparent',
                color: dateWindow === w ? '#fff' : '#9ca3af',
              }}
            >
              {WINDOW_LABELS[w]}
            </button>
          ))}
        </div>

        {/* Overall / My Team toggle */}
        <div
          className="flex rounded-xl p-1 gap-1"
          style={{ backgroundColor: theme.cardBackground }}
        >
          <ScopeButton
            active={scope === 'overall'}
            onClick={() => setScope('overall')}
            color={theme.primary}
          >
            <Globe size={13} />
            <span>Overall</span>
            {!loading && (
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded-full ml-0.5"
                style={{ backgroundColor: scope === 'overall' ? '#ffffff22' : '#ffffff11', color: '#fff' }}
              >
                {predictions.length}
              </span>
            )}
          </ScopeButton>

          <ScopeButton
            active={scope === 'myteam'}
            onClick={() => selectedTeamId ? setScope('myteam') : null}
            color={theme.primary}
            disabled={!selectedTeamId}
          >
            {selectedTeam ? (
              <TeamLogo teamId={selectedTeam.id} abbreviation={selectedTeam.abbreviation} size={14} />
            ) : (
              <Users size={13} />
            )}
            <span>{selectedTeam ? selectedTeam.name.split(' ').slice(-1)[0] : 'My Team'}</span>
            {!loading && selectedTeamId && (
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded-full ml-0.5"
                style={{ backgroundColor: scope === 'myteam' ? '#ffffff22' : '#ffffff11', color: '#fff' }}
              >
                {predictions.filter(p => p.teamId === selectedTeamId).length}
              </span>
            )}
          </ScopeButton>
        </div>

        {/* No team selected nudge */}
        {scope === 'overall' && !selectedTeamId && !loading && (
          <Link
            href="/settings"
            className="mt-2 flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <Users size={11} />
            Select your team in Settings to filter to your players →
          </Link>
        )}
      </div>

      <div className="px-4 pb-6">
        {loading && <LoadingSpinner message="Loading trending players..." />}

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center mt-2">
            {error}
          </div>
        )}

        {/* My Team — no players on team today */}
        {!loading && scope === 'myteam' && selectedTeamId && scoped.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
            {selectedTeam && <TeamLogo teamId={selectedTeam.id} abbreviation={selectedTeam.abbreviation} size={52} />}
            <p className="text-white font-semibold">No {selectedTeam?.name} players trending</p>
            <p className="text-gray-400 text-sm max-w-xs">
              {usedDummy ? 'No featured players from your team today.' : 'Your team may not have a game right now.'}
            </p>
            <button
              onClick={() => setScope('overall')}
              className="mt-1 text-sm font-semibold px-4 py-2 rounded-xl"
              style={{ backgroundColor: `${theme.primary}33`, color: theme.primary }}
            >
              View Overall Trending
            </button>
          </div>
        )}

        {/* Search: no trending match message */}
        {searchQuery.length > 0 && !loading && scoped.length === 0 && mlbResults.length === 0 && !mlbSearching && (
          <p className="text-center text-slate-500 text-sm py-6">No players found for "{searchQuery}"</p>
        )}

        {!loading && !error && scoped.length > 0 && (
          <div className="space-y-5 mt-1">
            {/* Rising bucket */}
            {rising.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: '#22c55e18' }}>
                    <TrendingUp size={13} className="text-green-400" />
                    <span className="text-green-400 text-xs font-bold">{rising.length} Rising</span>
                  </div>
                  {!loading && (
                    <p className="text-gray-500 text-xs">
                      {scope === 'myteam' ? `${selectedTeam?.name} · ` : ''}cards gaining value
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  {rising.map((p, i) => (
                    <TrendingPlayerCard key={p.playerId} prediction={p} rank={i + 1} />
                  ))}
                </div>
              </section>
            )}

            {/* Falling bucket */}
            {falling.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: '#ef444418' }}>
                    <TrendingDown size={13} className="text-red-400" />
                    <span className="text-red-400 text-xs font-bold">{falling.length} Falling</span>
                  </div>
                  {!loading && (
                    <p className="text-gray-500 text-xs">cards losing value today</p>
                  )}
                </div>
                <div className="space-y-2">
                  {falling.map((p, i) => (
                    <TrendingPlayerCard key={p.playerId} prediction={p} rank={i + 1} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
        {/* MLB-wide search results (non-trending players) */}
        {(mlbSearching || mlbResults.length > 0) && (
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              {mlbSearching ? 'Searching…' : 'Other players'}
            </p>
            <div className="space-y-2">
              {mlbResults.slice(0, 8).map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200"
                  style={{ backgroundColor: theme.cardBackground }}
                >
                  <PlayerHeadshot playerId={p.id} playerName={p.fullName} size={42} />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 font-semibold text-sm truncate">{p.fullName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {p.currentTeam && <TeamLogo teamId={p.currentTeam.id} abbreviation="" size={12} />}
                      <span className="text-gray-500 text-xs">
                        {[p.currentTeam?.name ?? 'Free Agent', p.primaryPosition?.abbreviation].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleWatch({
                      playerId: p.id,
                      playerName: p.fullName,
                      teamId: p.currentTeam?.id ?? 0,
                      position: p.primaryPosition?.abbreviation ?? '',
                    })}
                    className="p-2 rounded-xl transition-colors"
                    style={{ backgroundColor: isWatched(p.id) ? `${theme.primary}22` : 'rgba(0,0,0,0.04)' }}
                  >
                    <Star
                      size={16}
                      style={{ color: isWatched(p.id) ? theme.primary : '#9ca3af' }}
                      fill={isWatched(p.id) ? theme.primary : 'none'}
                    />
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

function ScopeButton({
  active, onClick, color, disabled = false, children,
}: {
  active: boolean; onClick: () => void; color: string;
  disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-all"
      style={{
        backgroundColor: active ? color : 'transparent',
        color: active ? '#fff' : disabled ? '#4b5563' : '#9ca3af',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}
