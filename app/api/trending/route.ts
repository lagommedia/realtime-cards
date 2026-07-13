import { NextRequest, NextResponse } from 'next/server';
import {
  getTodayGames, getLiveGameFeed, extractLivePlayerStats,
  getScheduleForDateRange, aggregatePlayerStatsFromGames, getSeasonStatsLeaders,
} from '@/lib/mlb-api';
import { getPlayerCardPricing } from '@/lib/ebay-api';
import { generateCardPrediction, generateTrendingPredictions } from '@/lib/predictions';
import { getDummyTrendingPredictions } from '@/lib/dummy-data';
import { LivePlayerStat, GameEvent } from '@/types';

type DateWindow = 'day' | 'week' | 'month' | 'season';

function etDateOffset(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000)
    .toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

async function getPredictionsForWindow(
  window: DateWindow,
  grading: string | undefined,
  grade: string | undefined,
): Promise<{ players: LivePlayerStat[]; gameCount: number; usedDummy: boolean; perGameEvents?: Map<number, GameEvent[]> }> {

  if (window === 'day') {
    const games = await getTodayGames();
    const active = games.filter(g =>
      g.status.abstractGameState === 'Live' || g.status.abstractGameState === 'Final'
    ).slice(0, 4);

    if (active.length === 0) return { players: [], gameCount: 0, usedDummy: true };

    const allPlayers = await Promise.all(
      active.map(async (game) => {
        try {
          const liveData = await getLiveGameFeed(game.gamePk);
          return extractLivePlayerStats(liveData as Record<string, unknown>);
        } catch { return [] as LivePlayerStat[]; }
      })
    );
    const seen = new Set<number>();
    const flat = allPlayers.flat().filter(p => {
      if (seen.has(p.playerId)) return false;
      seen.add(p.playerId); return true;
    });
    return { players: flat, gameCount: active.length, usedDummy: false };
  }

  if (window === 'season') {
    const players = await getSeasonStatsLeaders();
    return { players, gameCount: 0, usedDummy: false };
  }

  // week or month — aggregate recent boxscores with per-game event tracking
  const daysBack = window === 'week' ? 7 : 30;
  const maxGames = window === 'week' ? 20 : 25;
  const startDate = etDateOffset(daysBack);
  const endDate   = etDateOffset(1); // through yesterday; today is 'day' window

  const allGames = await getScheduleForDateRange(startDate, endDate);
  // Take the most recent N games (ordered chronologically; slice from end)
  const games = allGames.slice(-maxGames);
  const { players, perGameEvents } = await aggregatePlayerStatsFromGames(games);
  return { players, gameCount: games.length, usedDummy: false, perGameEvents };
}

export async function GET(req: NextRequest) {
  const grading = req.nextUrl.searchParams.get('grading') ?? undefined;
  const grade   = req.nextUrl.searchParams.get('grade')   ?? undefined;
  const window  = (req.nextUrl.searchParams.get('window') ?? 'day') as DateWindow;

  try {
    const { players, gameCount, usedDummy, perGameEvents } = await getPredictionsForWindow(window, grading, grade);

    let predictions;
    if (usedDummy || players.length === 0) {
      predictions = getDummyTrendingPredictions();
    } else {
      const topTrending = generateTrendingPredictions(players).slice(0, 12);
      predictions = await Promise.all(
        topTrending.map(async (player) => {
          const priceSummary = await getPlayerCardPricing(
            player.playerId, player.playerName, player.debutYear, grading, grade
          );
          const gameEvents = perGameEvents?.get(player.playerId);
          return generateCardPrediction(player, priceSummary, window, gameEvents);
        })
      );
    }

    // Team → game status map (only relevant for day window)
    const teamGameStatuses: Record<number, 'live' | 'final' | 'scheduled'> = {};
    const teamGameTimes: Record<number, string> = {};
    if (window === 'day') {
      const games = await getTodayGames();
      for (const game of games) {
        const raw = game.status.abstractGameState;
        const status: 'live' | 'final' | 'scheduled' =
          raw === 'Live' ? 'live' : raw === 'Final' ? 'final' : 'scheduled';
        for (const side of ['home', 'away'] as const) {
          teamGameStatuses[game.teams[side].team.id] = status;
          teamGameTimes[game.teams[side].team.id] = game.gameDate;
        }
      }
    }

    return NextResponse.json({
      predictions,
      gameCount,
      usedDummy: usedDummy || players.length === 0,
      window,
      teamGameStatuses,
      teamGameTimes,
    });
  } catch (error) {
    console.error('Trending API error:', error);
    return NextResponse.json({
      predictions: getDummyTrendingPredictions(),
      gameCount: 0,
      usedDummy: true,
      window,
      teamGameStatuses: {},
      teamGameTimes: {},
    });
  }
}
