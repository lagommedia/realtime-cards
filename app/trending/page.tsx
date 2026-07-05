'use client';

import { useEffect, useState } from 'react';
import { CardPrediction } from '@/types';
import { useTeam } from '@/context/TeamContext';
import TrendingPlayerCard from '@/components/TrendingPlayerCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import TeamLogo from '@/components/TeamLogo';
import { ALL_TEAMS } from '@/lib/team-themes';
import { RefreshCw, TrendingUp, TrendingDown, Users, Globe } from 'lucide-react';
import Link from 'next/link';

type Scope = 'overall' | 'myteam';

export default function TrendingPage() {
  const { theme, selectedTeamId } = useTeam();
  const [predictions, setPredictions] = useState<CardPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameCount, setGameCount] = useState(0);
  const [usedDummy, setUsedDummy] = useState(false);
  const [error, setError] = useState('');
  const [scope, setScope] = useState<Scope>('overall');

  const selectedTeam = ALL_TEAMS.find(t => t.id === selectedTeamId);

  async function fetchTrending() {
    try {
      setError('');
      const res = await fetch('/api/trending');
      const data = await res.json() as {
        predictions: CardPrediction[]; gameCount: number;
        usedDummy?: boolean; error?: string;
      };
      if (data.error && !data.predictions?.length) {
        setError(data.error);
      } else {
        setPredictions(data.predictions ?? []);
        setGameCount(data.gameCount ?? 0);
        setUsedDummy(data.usedDummy ?? false);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTrending();
    const interval = setInterval(fetchTrending, 120_000);
    return () => clearInterval(interval);
  }, []);

  // Apply scope filter
  const scoped = scope === 'myteam' && selectedTeamId
    ? predictions.filter(p => p.teamId === selectedTeamId)
    : predictions;

  const rising = scoped.filter(p => p.direction === 'up');
  const falling = scoped.filter(p => p.direction === 'down');

  const totalRising = predictions.filter(p => p.direction === 'up').length;
  const totalFalling = predictions.filter(p => p.direction === 'down').length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0f1e' }}>
      {/* Header */}
      <div className="px-4 pt-12 pb-3" style={{ background: `linear-gradient(180deg, ${theme.primary}33 0%, transparent 100%)` }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Trending</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {usedDummy
                ? 'Featured players · tap to expand'
                : gameCount > 0
                  ? `Live across ${gameCount} game${gameCount !== 1 ? 's' : ''} · tap to expand`
                  : 'Tap any player to expand'}
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); fetchTrending(); }}
            className="p-2 rounded-xl border border-white/10 text-gray-400"
            style={{ backgroundColor: theme.cardBackground }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
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
            className="mt-2 flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-dashed border-white/15 text-gray-500 hover:text-gray-300 transition-colors"
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
