import { NextRequest, NextResponse } from 'next/server';
import { getLiveGameFeed, extractLivePlayerStats } from '@/lib/mlb-api';
import { getPlayerCardPricing } from '@/lib/ebay-api';
import { generateCardPrediction } from '@/lib/predictions';
import { DUMMY_GAME_ID, DUMMY_GAME_META, getDummyGamePredictions, LiveMatchup } from '@/lib/dummy-game-chc-stl';

interface TeamInfo {
  id: number;
  name: string;
  abbreviation: string;
  score: number;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;

    // ── Dummy CHC vs STL live game ──────────────────────────────────────────
    if (gameId === DUMMY_GAME_ID) {
      return NextResponse.json({
        predictions: getDummyGamePredictions(),
        awayTeam: DUMMY_GAME_META.awayTeam,
        homeTeam: DUMMY_GAME_META.homeTeam,
        isLive: true,
        inning: DUMMY_GAME_META.inning,
        outs: DUMMY_GAME_META.outs,
        liveMatchup: DUMMY_GAME_META.liveMatchup,
        playerCount: 25,
      });
    }

    const gamePk = parseInt(gameId, 10);
    const liveData = await getLiveGameFeed(gamePk);
    const players = extractLivePlayerStats(liveData as Record<string, unknown>);

    // ── Extract structured game info ────────────────────────────────────────
    const gameData = (liveData as Record<string, unknown>).gameData as {
      teams?: {
        away?: { id?: number; name?: string; abbreviation?: string };
        home?: { id?: number; name?: string; abbreviation?: string };
      };
      status?: { abstractGameState?: string };
    } | undefined;

    const liveDataFeed = (liveData as Record<string, unknown>).liveData as {
      linescore?: {
        currentInningOrdinal?: string;
        inningHalf?: string;
        teams?: {
          away?: { runs?: number };
          home?: { runs?: number };
        };
      };
    } | undefined;

    const isLive = gameData?.status?.abstractGameState === 'Live';
    const inningOrdinal = liveDataFeed?.linescore?.currentInningOrdinal;
    const inningHalf = liveDataFeed?.linescore?.inningHalf;
    const inning = inningOrdinal
      ? `${inningHalf === 'Top' ? '▲' : '▼'} ${inningOrdinal}`
      : null;

    const awayTeam: TeamInfo = {
      id: gameData?.teams?.away?.id ?? 0,
      name: gameData?.teams?.away?.name ?? 'Away',
      abbreviation: gameData?.teams?.away?.abbreviation ?? 'AWY',
      score: liveDataFeed?.linescore?.teams?.away?.runs ?? 0,
    };
    const homeTeam: TeamInfo = {
      id: gameData?.teams?.home?.id ?? 0,
      name: gameData?.teams?.home?.name ?? 'Home',
      abbreviation: gameData?.teams?.home?.abbreviation ?? 'HME',
      score: liveDataFeed?.linescore?.teams?.home?.runs ?? 0,
    };

    // ── Generate predictions (limit to 16 to avoid rate limits) ─────────────
    const topPlayers = players.slice(0, 16);
    const predictions = await Promise.all(
      topPlayers.map(async (player) => {
        const priceSummary = await getPlayerCardPricing(player.playerId, player.playerName);
        return generateCardPrediction(player, priceSummary);
      })
    );

    return NextResponse.json({
      predictions,
      awayTeam,
      homeTeam,
      isLive,
      inning,
      playerCount: players.length,
    });
  } catch (error) {
    console.error('Game API error:', error);
    return NextResponse.json({
      error: 'Failed to fetch game data',
      predictions: [],
      awayTeam: { id: 0, name: 'Away', abbreviation: 'AWY', score: 0 },
      homeTeam: { id: 0, name: 'Home', abbreviation: 'HME', score: 0 },
      isLive: false,
      inning: null,
      playerCount: 0,
    }, { status: 500 });
  }
}
