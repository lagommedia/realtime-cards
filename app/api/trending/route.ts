import { NextResponse } from 'next/server';
import { getTodayGames, getLiveGameFeed, extractLivePlayerStats } from '@/lib/mlb-api';
import { getPlayerCardPricing } from '@/lib/ebay-api';
import { generateCardPrediction, generateTrendingPredictions } from '@/lib/predictions';
import { getDummyTrendingPredictions } from '@/lib/dummy-data';
import { LivePlayerStat } from '@/types';

export async function GET() {
  try {
    const games = await getTodayGames();

    const liveOrFinalGames = games.filter(g =>
      g.status.abstractGameState === 'Live' || g.status.abstractGameState === 'Final'
    ).slice(0, 4);

    let predictions;
    let gameCount = 0;
    let usedDummy = false;

    if (liveOrFinalGames.length > 0) {
      const allPlayers = await Promise.all(
        liveOrFinalGames.map(async (game) => {
          try {
            const liveData = await getLiveGameFeed(game.gamePk);
            return extractLivePlayerStats(liveData as Record<string, unknown>);
          } catch {
            return [] as LivePlayerStat[];
          }
        })
      );

      const flatPlayers = allPlayers.flat();
      gameCount = liveOrFinalGames.length;

      const topTrending = generateTrendingPredictions(flatPlayers).slice(0, 12);
      predictions = await Promise.all(
        topTrending.map(async (player) => {
          const priceSummary = await getPlayerCardPricing(player.playerId, player.playerName, player.debutYear);
          return generateCardPrediction(player, priceSummary);
        })
      );
    } else {
      // No live or final games — use curated dummy data
      predictions = getDummyTrendingPredictions();
      usedDummy = true;
    }

    // Build team → game status map from all of today's games (including scheduled)
    const teamGameStatuses: Record<number, 'live' | 'final' | 'scheduled'> = {};
    const teamGameTimes: Record<number, string> = {};
    for (const game of games) {
      const raw = game.status.abstractGameState;
      const status: 'live' | 'final' | 'scheduled' =
        raw === 'Live' ? 'live' : raw === 'Final' ? 'final' : 'scheduled';
      for (const side of ['home', 'away'] as const) {
        const teamId = game.teams[side].team.id;
        teamGameStatuses[teamId] = status;
        teamGameTimes[teamId] = game.gameDate;
      }
    }

    return NextResponse.json({ predictions, gameCount, usedDummy, teamGameStatuses, teamGameTimes });
  } catch (error) {
    console.error('Trending API error:', error);
    return NextResponse.json({
      predictions: getDummyTrendingPredictions(),
      gameCount: 0,
      usedDummy: true,
      teamGameStatuses: {},
      teamGameTimes: {},
    });
  }
}
