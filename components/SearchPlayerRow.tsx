'use client';

import { useState } from 'react';
import { CardPrediction } from '@/types';
import { useTeam } from '@/context/TeamContext';
import { useGrading } from '@/context/GradingContext';
import { useWatchList } from '@/context/WatchListContext';
import PlayerHeadshot from '@/components/PlayerHeadshot';
import TeamLogo from '@/components/TeamLogo';
import TrendingPlayerCard from '@/components/TrendingPlayerCard';
import { Star, ChevronDown } from 'lucide-react';

interface Props {
  playerId: number;
  playerName: string;
  teamId: number;
  teamName?: string;
  position: string;
}

export default function SearchPlayerRow({ playerId, playerName, teamId, teamName, position }: Props) {
  const { theme } = useTeam();
  const { companyId, gradeValue } = useGrading();
  const { isWatched, toggleWatch } = useWatchList();
  const [prediction, setPrediction] = useState<CardPrediction | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleTap() {
    if (prediction || loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (companyId) { params.set('grading', companyId); if (gradeValue) params.set('grade', gradeValue); }
      const res = await fetch(`/api/player/${playerId}/prediction?${params}`);
      const d = await res.json() as CardPrediction & { error?: string };
      if (!d.error) setPrediction(d);
    } catch { /* swallow */ } finally {
      setLoading(false);
    }
  }

  if (prediction) {
    return <TrendingPlayerCard prediction={prediction} rank={0} defaultExpanded />;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleTap}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleTap(); }}
      className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 cursor-pointer active:opacity-70 select-none"
      style={{ backgroundColor: theme.cardBackground }}
    >
      <PlayerHeadshot playerId={playerId} playerName={playerName} size={42} />
      <div className="flex-1 min-w-0">
        <p className="text-slate-900 font-semibold text-sm truncate">{playerName}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {teamId > 0 && <TeamLogo teamId={teamId} abbreviation="" size={12} />}
          <span className="text-gray-500 text-xs">
            {[teamName ?? (teamId > 0 ? '' : 'Free Agent'), position].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{
          width: 15, height: 15, flexShrink: 0,
          border: '2px solid #e2e8f0', borderTopColor: theme.primary,
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
      ) : (
        <ChevronDown size={15} style={{ color: '#94a3b8', flexShrink: 0 }} />
      )}

      <button
        onClick={e => {
          e.stopPropagation();
          toggleWatch({ playerId, playerName, teamId, position });
        }}
        className="p-2 rounded-xl transition-colors"
        style={{ backgroundColor: isWatched(playerId) ? `${theme.primary}22` : 'rgba(0,0,0,0.04)' }}
      >
        <Star
          size={16}
          style={{ color: isWatched(playerId) ? theme.primary : '#9ca3af' }}
          fill={isWatched(playerId) ? theme.primary : 'none'}
        />
      </button>
    </div>
  );
}
