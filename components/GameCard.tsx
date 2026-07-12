'use client';

import { MLBGame } from '@/types';
import { useTeam } from '@/context/TeamContext';
import { useRouter } from 'next/navigation';
import { Radio, Clock, CheckCircle } from 'lucide-react';
import TeamLogo from '@/components/TeamLogo';

interface Props {
  game: MLBGame;
}

const STATUS_CONFIG = {
  Live: { icon: Radio, color: '#22c55e', label: 'LIVE' },
  Final: { icon: CheckCircle, color: '#9ca3af', label: 'FINAL' },
  Preview: { icon: Clock, color: '#60a5fa', label: 'UPCOMING' },
};

export default function GameCard({ game }: Props) {
  const { theme } = useTeam();
  const router = useRouter();

  const state = game.status.abstractGameState as keyof typeof STATUS_CONFIG;
  const config = STATUS_CONFIG[state] ?? STATUS_CONFIG.Preview;
  const StatusIcon = config.icon;

  const isLive = state === 'Live';
  const inning = game.linescore?.currentInningOrdinal;
  const half = game.linescore?.inningHalf;

  const awayScore = game.teams.away.score;
  const homeScore = game.teams.home.score;

  return (
    <button
      onClick={() => router.push(`/game/${game.gamePk}`)}
      className="glass-card w-full rounded-2xl p-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
    >
      {/* Status bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5" style={{ color: config.color }}>
          <StatusIcon size={12} className={isLive ? 'animate-pulse' : ''} />
          <span className="text-xs font-bold tracking-wider">{config.label}</span>
          {isLive && inning && (
            <span className="text-xs text-gray-400 font-normal ml-1">
              {half === 'Top' ? '▲' : '▼'} {inning}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">{game.venue.name}</span>
      </div>

      {/* Teams and scores */}
      <div className="space-y-2">
        <TeamRow
          teamId={game.teams.away.team.id}
          name={game.teams.away.team.name}
          abbreviation={game.teams.away.team.abbreviation}
          record={`${game.teams.away.leagueRecord.wins}-${game.teams.away.leagueRecord.losses}`}
          score={awayScore}
          showScore={state !== 'Preview'}
        />
        <TeamRow
          teamId={game.teams.home.team.id}
          name={game.teams.home.team.name}
          abbreviation={game.teams.home.team.abbreviation}
          record={`${game.teams.home.leagueRecord.wins}-${game.teams.home.leagueRecord.losses}`}
          score={homeScore}
          showScore={state !== 'Preview'}
        />
      </div>

      {/* CTA */}
      <div
        className="mt-3 text-center text-xs font-semibold py-2 rounded-xl"
        style={{ color: theme.primary, backgroundColor: `${theme.primary}22` }}
      >
        {isLive ? 'Track Card Values Live →' : state === 'Final' ? 'View Post-Game Analysis →' : 'Preview Lineups →'}
      </div>
    </button>
  );
}

function TeamRow({
  teamId, name, abbreviation, record, score, showScore
}: {
  teamId: number; name: string; abbreviation: string; record: string;
  score?: number; showScore: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <TeamLogo teamId={teamId} abbreviation={abbreviation} size={36} />
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate">{name}</p>
          <p className="text-gray-500 text-xs">{record}</p>
        </div>
      </div>
      {showScore && score !== undefined && (
        <span className="text-white font-bold text-lg tabular-nums">{score}</span>
      )}
    </div>
  );
}
