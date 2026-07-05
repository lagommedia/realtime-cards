import { NextRequest, NextResponse } from 'next/server';
import { getLiveGameFeed } from '@/lib/mlb-api';
import { Pitch, LiveMatchup } from '@/lib/dummy-game-chc-stl';

const PITCH_CODE_MAP: Record<string, Pitch['result']> = {
  B: 'ball', I: 'ball', P: 'ball',
  C: 'called_strike',
  S: 'swinging_strike', T: 'swinging_strike', M: 'swinging_strike', O: 'swinging_strike',
  F: 'foul', L: 'foul', R: 'foul',
};

function normX(pX: number) { return Math.max(0.05, Math.min(0.95, (pX + 1.25) / 2.5)); }
function normY(pZ: number) { return Math.max(0.05, Math.min(0.95, (pZ - 1.0) / 3.0)); }

function buildMatchup(raw: Record<string, unknown>): LiveMatchup | null {
  try {
    const ld = (raw as { liveData?: Record<string, unknown> }).liveData;
    const gd = (raw as { gameData?: Record<string, unknown> }).gameData;
    if (!ld || !gd) return null;

    const cp = (ld.plays as { currentPlay?: Record<string, unknown> } | undefined)?.currentPlay;
    if (!cp) return null;

    const matchup = cp.matchup as {
      batter: { id: number; fullName: string };
      pitcher: { id: number; fullName: string };
    } | undefined;
    if (!matchup?.batter?.id || !matchup?.pitcher?.id) return null;

    const count = cp.count as { balls: number; strikes: number } | undefined;
    const gPlayers = (gd.players as Record<string, { primaryNumber?: string }>) ?? {};

    let batterSeasonAvg = '.---', batterAB = 0, batterH = 0;
    let pitcherEra = '-.-', pitcherPitches = 0;

    const boxTeams = (ld.boxscore as { teams?: Record<string, {
      players?: Record<string, {
        person?: { id: number };
        stats?: { batting?: { atBats?: number; hits?: number }; pitching?: { numberOfPitches?: number } };
        seasonStats?: { batting?: { avg?: string }; pitching?: { era?: string } };
      }>;
    }> } | undefined)?.teams ?? {};

    for (const side of ['away', 'home'] as const) {
      for (const p of Object.values(boxTeams[side]?.players ?? {})) {
        if (p.person?.id === matchup.batter.id) {
          batterSeasonAvg = p.seasonStats?.batting?.avg ?? '.---';
          batterAB = p.stats?.batting?.atBats ?? 0;
          batterH = p.stats?.batting?.hits ?? 0;
        }
        if (p.person?.id === matchup.pitcher.id) {
          pitcherEra = p.seasonStats?.pitching?.era ?? '-.-';
          pitcherPitches = p.stats?.pitching?.numberOfPitches ?? 0;
        }
      }
    }

    const pParts = matchup.pitcher.fullName.split(' ');
    const pitcherName = pParts.length > 1
      ? `${pParts[0][0]}. ${pParts.slice(1).join(' ')}`
      : matchup.pitcher.fullName;

    const playEvents = cp.playEvents as Array<{
      isPitch?: boolean;
      pitchNumber?: number;
      details?: { code?: string; type?: { code?: string } };
      pitchData?: { coordinates?: { pX?: number | null; pZ?: number | null }; startSpeed?: number };
    }> | undefined;

    const pitches: Pitch[] = (playEvents ?? [])
      .filter(e => e.isPitch && e.pitchData?.coordinates?.pX != null && e.pitchData?.coordinates?.pZ != null)
      .map(e => ({
        seq: e.pitchNumber ?? 1,
        x: normX(e.pitchData!.coordinates!.pX!),
        y: normY(e.pitchData!.coordinates!.pZ!),
        result: PITCH_CODE_MAP[e.details?.code ?? ''] ?? 'ball',
        pitchType: e.details?.type?.code,
        velocity: e.pitchData?.startSpeed,
      }));

    const offense = (ld.linescore as {
      offense?: { first?: { id: number }; second?: { id: number }; third?: { id: number } };
    } | undefined)?.offense ?? {};

    // Last completed at-bat result
    const atBatIndex = (cp.atBatIndex as number | undefined) ?? 0;
    const allPlays = (ld.plays as { allPlays?: Array<{
      result: { event: string };
      matchup: { batter: { fullName: string } };
    }> } | undefined)?.allPlays ?? [];
    let lastResult: { event: string; batterName: string } | undefined;
    if (atBatIndex > 0) {
      const prev = allPlays[atBatIndex - 1];
      if (prev?.result?.event && prev.result.event !== 'In Progress') {
        lastResult = { event: prev.result.event, batterName: prev.matchup.batter.fullName };
      }
    }

    return {
      batterId: matchup.batter.id,
      pitcherId: matchup.pitcher.id,
      batter: {
        name: matchup.batter.fullName,
        number: gPlayers[`ID${matchup.batter.id}`]?.primaryNumber ?? '?',
        seasonAvg: batterSeasonAvg,
        atBatsToday: batterAB,
        hitsToday: batterH,
      },
      pitcher: {
        name: pitcherName,
        number: gPlayers[`ID${matchup.pitcher.id}`]?.primaryNumber ?? '?',
        seasonEra: pitcherEra,
        pitchCount: pitcherPitches,
        balls: count?.balls ?? 0,
        strikes: count?.strikes ?? 0,
      },
      bases: {
        first: !!(offense as { first?: { id: number } }).first?.id,
        second: !!(offense as { second?: { id: number } }).second?.id,
        third: !!(offense as { third?: { id: number } }).third?.id,
      },
      pitches,
      lastResult,
    };
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const gamePk = parseInt(gameId, 10);
    if (isNaN(gamePk)) return NextResponse.json({ liveMatchup: null }, { status: 400 });

    const raw = await getLiveGameFeed(gamePk) as Record<string, unknown>;
    const ld = (raw as { liveData?: Record<string, unknown> }).liveData;
    const ls = (ld as { linescore?: {
      currentInningOrdinal?: string;
      inningHalf?: string;
      outs?: number;
      teams?: { away?: { runs?: number }; home?: { runs?: number } };
    } } | undefined)?.linescore;

    const inningOrdinal = ls?.currentInningOrdinal;
    const inningHalf = ls?.inningHalf;
    const inning = inningOrdinal ? `${inningHalf === 'Top' ? '▲' : '▼'} ${inningOrdinal}` : null;
    const gameState = (raw as { gameData?: { status?: { abstractGameState?: string } } })
      .gameData?.status?.abstractGameState;
    const isFinal = gameState === 'Final';

    return NextResponse.json({
      liveMatchup: buildMatchup(raw),
      inning,
      outs: ls?.outs ?? 0,
      awayScore: ls?.teams?.away?.runs ?? 0,
      homeScore: ls?.teams?.home?.runs ?? 0,
      isFinal,
    });
  } catch (error) {
    console.error('Live matchup error:', error);
    return NextResponse.json({ liveMatchup: null }, { status: 500 });
  }
}
