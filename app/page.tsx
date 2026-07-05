'use client';

import { useEffect, useState } from 'react';
import { MLBGame } from '@/types';
import { useTeam } from '@/context/TeamContext';
import GameCard from '@/components/GameCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import Link from 'next/link';
import { RefreshCw, Star } from 'lucide-react';

export default function HomePage() {
  const { theme, selectedTeamId } = useTeam();
  const [games, setGames] = useState<MLBGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function fetchGames() {
    try {
      setError('');
      const res = await fetch('/api/games');
      const data = await res.json() as { games: MLBGame[]; error?: string };
      if (data.error && !data.games?.length) {
        setError('Unable to load games. Check your connection.');
      } else {
        setGames(data.games ?? []);
        setLastUpdated(new Date());
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 60_000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const liveGames = games.filter(g => g.status.abstractGameState === 'Live');
  const upcomingGames = games.filter(g => g.status.abstractGameState === 'Preview');
  const finalGames = games.filter(g => g.status.abstractGameState === 'Final');

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0f1e' }}>
      {/* Header */}
      <div className="px-4 pt-12 pb-4" style={{ background: `linear-gradient(180deg, ${theme.primary}33 0%, transparent 100%)` }}>
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-2xl font-bold text-white">CardTracker</h1>
            <p className="text-xs text-gray-400">{today}</p>
          </div>
          <button
            onClick={() => { setLoading(true); fetchGames(); }}
            className="p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-colors"
            style={{ backgroundColor: theme.cardBackground }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {!selectedTeamId && (
          <Link
            href="/settings"
            className="mt-3 flex items-center gap-2 p-3 rounded-xl border border-dashed border-white/20 text-sm text-gray-400 hover:border-white/40 transition-colors"
          >
            <Star size={14} style={{ color: theme.primary }} />
            Pick your favorite team to personalize the app →
          </Link>
        )}
      </div>

      <div className="px-4 space-y-6">
        {loading && <LoadingSpinner message="Loading today's games..." />}

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {!loading && !error && games.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <p className="text-2xl">⚾</p>
            <p className="text-white font-semibold">No games today</p>
            <p className="text-gray-400 text-sm">Check back tomorrow for the next game day</p>
          </div>
        )}

        {liveGames.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Live Now</h2>
            </div>
            <div className="space-y-3">
              {liveGames.map(game => <GameCard key={game.gamePk} game={game} />)}
            </div>
          </section>
        )}

        {finalGames.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Finished Today</h2>
            <div className="space-y-3">
              {finalGames.map(game => <GameCard key={game.gamePk} game={game} />)}
            </div>
          </section>
        )}

        {upcomingGames.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Upcoming</h2>
            <div className="space-y-3">
              {upcomingGames.map(game => <GameCard key={game.gamePk} game={game} />)}
            </div>
          </section>
        )}

        {lastUpdated && !loading && (
          <p className="text-center text-xs text-gray-600 pb-4">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Auto-refreshes every minute
          </p>
        )}
      </div>
    </div>
  );
}
