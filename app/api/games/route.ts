import { NextResponse } from 'next/server';
import { getTodayGames } from '@/lib/mlb-api';
import { DUMMY_GAME_ID, DUMMY_GAME_META } from '@/lib/dummy-game-chc-stl';
import { MLBGame } from '@/types';

const DUMMY_CHC_STL: MLBGame = {
  gamePk: 99001,
  gameDate: new Date().toISOString(),
  status: {
    abstractGameState: 'Live',
    detailedState: 'In Progress',
    statusCode: 'I',
  },
  teams: {
    away: {
      team: { id: 112, name: 'Chicago Cubs', abbreviation: 'CHC', locationName: 'Chicago', teamName: 'Cubs' },
      score: DUMMY_GAME_META.awayTeam.score,
      leagueRecord: { wins: 48, losses: 38 },
    },
    home: {
      team: { id: 138, name: 'St. Louis Cardinals', abbreviation: 'STL', locationName: 'St. Louis', teamName: 'Cardinals' },
      score: DUMMY_GAME_META.homeTeam.score,
      leagueRecord: { wins: 41, losses: 45 },
    },
  },
  venue: { name: 'Busch Stadium' },
  linescore: {
    currentInning: 6,
    currentInningOrdinal: '6th',
    inningHalf: 'Top',
    outs: DUMMY_GAME_META.outs,
  },
  // Override gamePk with the string ID so the game link routes correctly
  // The GameCard uses game.gamePk for the route, so we patch it here
  gamePk: DUMMY_GAME_ID as unknown as number,
};

export async function GET() {
  try {
    const real = await getTodayGames();
    // Prepend the dummy live game so it always appears at the top of "Live Now"
    return NextResponse.json({ games: [DUMMY_CHC_STL, ...real] });
  } catch {
    return NextResponse.json({ games: [DUMMY_CHC_STL] });
  }
}
