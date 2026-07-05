'use client';

import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CardPrediction } from '@/types';
import { useTeam } from '@/context/TeamContext';
import { useWatchList } from '@/context/WatchListContext';
import TrendingPlayerCard from '@/components/TrendingPlayerCard';
import PlayerHeadshot from '@/components/PlayerHeadshot';
import { ArrowLeft, Star, ShoppingCart, ExternalLink } from 'lucide-react';
import { SET_PRICE_MULTIPLIERS } from '@/lib/predictions';
import { getTeamTheme } from '@/lib/team-themes';

interface TrendingResponse {
  predictions: CardPrediction[];
  usedDummy: boolean;
}

export default function PlayerProfilePage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId: playerIdStr } = use(params);
  const playerId = parseInt(playerIdStr, 10);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTeam();
  const { isWatched, toggleWatch } = useWatchList();

  // Fallback info passed as query params from the game view
  const fallbackName = searchParams.get('name') ?? 'Player';
  const fallbackTeamId = parseInt(searchParams.get('teamId') ?? '0', 10);
  const fallbackPosition = searchParams.get('position') ?? '';
  const fallbackTheme = fallbackTeamId ? getTeamTheme(fallbackTeamId) : theme;

  const [prediction, setPrediction] = useState<CardPrediction | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fallbackGameId = searchParams.get('gameId');

    const fromTrending = fetch('/api/trending')
      .then(r => r.json())
      .then((data: TrendingResponse) => {
        if (!data.usedDummy) setIsLive(true);
        return data.predictions.find(p => p.playerId === playerId) ?? null;
      })
      .catch(() => null);

    const fromGame = fallbackGameId
      ? fetch(`/api/game/${fallbackGameId}`)
          .then(r => r.json())
          .then((data: { predictions?: CardPrediction[]; isLive?: boolean }) => {
            if (data.isLive) setIsLive(true);
            return data.predictions?.find(p => p.playerId === playerId) ?? null;
          })
          .catch(() => null)
      : Promise.resolve(null);

    Promise.all([fromTrending, fromGame])
      .then(([trendingResult, gameResult]) => {
        setPrediction(trendingResult ?? gameResult);
      })
      .finally(() => setLoading(false));
  }, [playerId, searchParams]);

  const firstCard = prediction?.rookieCardOptions?.[0];
  const setMultiplier = firstCard ? (SET_PRICE_MULTIPLIERS[firstCard.set] ?? 1) : 1;
  const displayPrice = (prediction?.currentPrice ?? 0) * setMultiplier;

  const ebayQuery = [
    prediction?.playerName ?? '',
    firstCard ? `${firstCard.year} ${firstCard.set}` : 'rookie card',
    'baseball card',
  ].filter(Boolean).join(' ');
  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(ebayQuery)}&_sacat=212&_sop=15`;

  const watched = isWatched(playerId);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0f1e' }}>
      {/* Header */}
      <div
        className="px-4 pt-12 pb-4"
        style={{ background: `linear-gradient(180deg, ${theme.primary}44 0%, transparent 100%)` }}
      >
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl border border-white/10 text-gray-400"
            style={{ backgroundColor: theme.cardBackground }}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="h-5 w-40 rounded-lg animate-pulse bg-white/10" />
            ) : (
              <h1 className="text-base font-black text-white leading-tight truncate">
                {prediction?.playerName ?? fallbackName}
              </h1>
            )}
            <p className="text-gray-500 text-xs mt-0.5">Card Profile</p>
          </div>
          {prediction && (
            <button
              onClick={() => toggleWatch({
                playerId: prediction.playerId,
                playerName: prediction.playerName,
                teamId: prediction.teamId,
                position: prediction.position,
              })}
              className="p-2 rounded-xl border transition-all"
              style={{
                backgroundColor: watched ? '#f59e0b18' : theme.cardBackground,
                borderColor: watched ? '#f59e0b44' : 'rgba(255,255,255,0.1)',
                color: watched ? '#f59e0b' : '#6b7280',
              }}
            >
              <Star size={18} fill={watched ? '#f59e0b' : 'none'} />
            </button>
          )}
        </div>

        {/* ── Quick Buy CTA — prominent above the card ── */}
        {!loading && prediction && (
          <a
            href={ebayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 px-4 py-4 rounded-2xl"
            style={{ backgroundColor: theme.primary }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              >
                <ShoppingCart size={20} color="#fff" />
              </div>
              <div>
                <p className="text-white font-black text-base leading-tight">Buy on eBay Now</p>
                <p className="text-white/75 text-xs leading-tight mt-0.5">
                  {firstCard ? `${firstCard.year} ${firstCard.shortName} RC` : 'Rookie Card'}
                  {displayPrice > 0 ? ` · ~$${displayPrice.toFixed(0)}` : ''}
                </p>
              </div>
            </div>
            <ExternalLink size={16} color="rgba(255,255,255,0.7)" />
          </a>
        )}
      </div>

      {/* Loading shimmer */}
      {loading && (
        <div className="px-4 space-y-3">
          <div className="h-20 rounded-2xl animate-pulse bg-white/5" />
          <div className="h-64 rounded-2xl animate-pulse bg-white/5" />
        </div>
      )}

      {/* Player not in today's trending data — show mini-profile from fallback params */}
      {!loading && !prediction && (
        <div className="px-4 flex flex-col gap-4">
          {/* Player card */}
          <div
            className="rounded-2xl p-4 border border-white/10 flex items-center gap-4"
            style={{ backgroundColor: fallbackTheme.cardBackground }}
          >
            <PlayerHeadshot playerId={playerId} playerName={fallbackName} size={64} />
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-lg leading-tight truncate">{fallbackName}</p>
              {fallbackPosition && (
                <p className="text-gray-400 text-sm mt-0.5">{fallbackPosition}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">No card prediction available today</p>
            </div>
            <button
              onClick={() => toggleWatch({ playerId, playerName: fallbackName, teamId: fallbackTeamId, position: fallbackPosition })}
              className="p-2 rounded-xl border transition-all flex-shrink-0"
              style={{
                backgroundColor: isWatched(playerId) ? '#f59e0b18' : fallbackTheme.cardBackground,
                borderColor: isWatched(playerId) ? '#f59e0b44' : 'rgba(255,255,255,0.1)',
                color: isWatched(playerId) ? '#f59e0b' : '#6b7280',
              }}
            >
              <Star size={18} fill={isWatched(playerId) ? '#f59e0b' : 'none'} />
            </button>
          </div>

          {/* eBay search CTA */}
          <a
            href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${fallbackName} rookie card baseball`)}&_sacat=212&_sop=15`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 px-4 py-4 rounded-2xl"
            style={{ backgroundColor: fallbackTheme.primary }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                <ShoppingCart size={20} color="#fff" />
              </div>
              <div>
                <p className="text-white font-black text-base leading-tight">Search on eBay</p>
                <p className="text-white/75 text-xs leading-tight mt-0.5">{fallbackName} · Rookie Card</p>
              </div>
            </div>
            <ExternalLink size={16} color="rgba(255,255,255,0.7)" />
          </a>
        </div>
      )}

      {/* Full expanded card */}
      {!loading && prediction && (
        <div className="px-4 pb-8">
          <TrendingPlayerCard
            prediction={prediction}
            rank={1}
            defaultChartView={isLive ? 'game' : 'season'}
            isLive={isLive}
            defaultExpanded
          />
        </div>
      )}
    </div>
  );
}
