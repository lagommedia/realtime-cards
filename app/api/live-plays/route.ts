import { NextResponse } from 'next/server';
import { getTodayGames, getLiveGameFeed } from '@/lib/mlb-api';
import { LiveGamePlays, RawPlay } from '@/lib/play-detector';

type RawFeed = {
  liveData?: {
    plays?: {
      allPlays?: Array<{
        about?: { atBatIndex?: number; isComplete?: boolean };
        result?: { event?: string; description?: string; rbi?: number };
        matchup?: { batter?: { id?: number } };
      }>;
    };
  };
  gameData?: {
    players?: Record<string, { id?: number; fullName?: string }>;
  };
};

export async function GET() {
  try {
    const games = await getTodayGames();
    const liveGames = games.filter(g => g.status.abstractGameState === 'Live');

    const results: LiveGamePlays[] = await Promise.all(
      liveGames.map(async (game): Promise<LiveGamePlays> => {
        try {
          const feed = (await getLiveGameFeed(game.gamePk)) as RawFeed;
          const allPlays = feed.liveData?.plays?.allPlays ?? [];
          const gamePlayers = feed.gameData?.players ?? {};

          const playerNames: Record<number, string> = {};
          for (const p of Object.values(gamePlayers)) {
            if (p.id && p.fullName) playerNames[p.id] = p.fullName;
          }

          const plays: RawPlay[] = allPlays
            .filter(p => p.about?.isComplete && p.result?.event && p.matchup?.batter?.id)
            .map(p => ({
              atBatIndex: p.about!.atBatIndex ?? 0,
              batterId: p.matchup!.batter!.id!,
              event: p.result!.event!,
              description: p.result?.description ?? '',
              rbi: p.result?.rbi ?? 0,
            }));

          return { gameId: game.gamePk, isLive: true, plays, playerNames };
        } catch {
          return { gameId: game.gamePk, isLive: false, plays: [], playerNames: {} };
        }
      })
    );

    return NextResponse.json({ games: results, timestamp: Date.now() });
  } catch {
    return NextResponse.json({ games: [], timestamp: Date.now() });
  }
}
