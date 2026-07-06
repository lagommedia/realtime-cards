import { NextRequest, NextResponse } from 'next/server';
import { getLiveGameFeed, extractLivePlayerStats } from '@/lib/mlb-api';
import { getPlayerCardPricing } from '@/lib/ebay-api';
import { generateCardPrediction } from '@/lib/predictions';
import { Pitch, LiveMatchup } from '@/lib/dummy-game-chc-stl';

interface TeamInfo {
  id: number;
  name: string;
  abbreviation: string;
  score: number;
}

// MLB pitch result code → our Pitch result type
const PITCH_CODE_MAP: Record<string, Pitch['result']> = {
  B: 'ball', I: 'ball', P: 'ball',
  C: 'called_strike',
  S: 'swinging_strike', T: 'swinging_strike', M: 'swinging_strike', O: 'swinging_strike',
  F: 'foul', L: 'foul', R: 'foul',
};

// MLB pitch coordinates (feet) → normalized 0–1 for StrikeZone component
// pX: negative = catcher's left (RHH outside), positive = catcher's right (RHH inside)
// pZ: feet from ground (~1.5–3.5 is the strike zone)
function normX(pX: number) { return Math.max(0.05, Math.min(0.95, (pX + 1.25) / 2.5)); }
function normY(pZ: number) { return Math.max(0.05, Math.min(0.95, (pZ - 1.0) / 3.0)); }

function buildLiveMatchup(raw: Record<string, unknown>): LiveMatchup | null {
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

    // Jersey numbers from gameData.players
    const gPlayers = (gd.players as Record<string, { primaryNumber?: string }>) ?? {};
    const bNum = gPlayers[`ID${matchup.batter.id}`]?.primaryNumber ?? '?';
    const pNum = gPlayers[`ID${matchup.pitcher.id}`]?.primaryNumber ?? '?';

    // Season stats + today's stats from boxscore
    let batterSeasonAvg = '.---';
    let batterAB = 0;
    let batterH = 0;
    let pitcherEra = '-.-';
    let pitcherPitches = 0;

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

    // Pitcher name as "F. LastName"
    const pParts = matchup.pitcher.fullName.split(' ');
    const pitcherName = pParts.length > 1
      ? `${pParts[0][0]}. ${pParts.slice(1).join(' ')}`
      : matchup.pitcher.fullName;

    // Pitches for this at-bat
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
      }))
      .filter(p => p.result !== undefined);

    // Base runners
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
        number: bNum,
        seasonAvg: batterSeasonAvg,
        atBatsToday: batterAB,
        hitsToday: batterH,
      },
      pitcher: {
        name: pitcherName,
        number: pNum,
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

    if (isNaN(gamePk)) {
      return NextResponse.json({ error: 'Invalid game ID', predictions: [], isLive: false }, { status: 400 });
    }

    const liveData = await getLiveGameFeed(gamePk);
    const rawFeed = liveData as Record<string, unknown>;
    const players = extractLivePlayerStats(rawFeed);

    // Structured game info
    const gameData = (rawFeed.gameData as {
      teams?: {
        away?: { id?: number; name?: string; abbreviation?: string };
        home?: { id?: number; name?: string; abbreviation?: string };
      };
      status?: { abstractGameState?: string };
    } | undefined);

    const liveDataFeed = (rawFeed.liveData as {
      linescore?: {
        currentInning?: number;
        currentInningOrdinal?: string;
        inningHalf?: string;
        outs?: number;
        teams?: {
          away?: { runs?: number };
          home?: { runs?: number };
        };
      };
    } | undefined);

    const isLive = gameData?.status?.abstractGameState === 'Live';
    const ls = liveDataFeed?.linescore;
    const inningOrdinal = ls?.currentInningOrdinal;
    const inningHalf = ls?.inningHalf;
    const inning = inningOrdinal
      ? `${inningHalf === 'Top' ? '▲' : '▼'} ${inningOrdinal}`
      : null;
    const outs = ls?.outs ?? 0;

    const awayTeam: TeamInfo = {
      id: gameData?.teams?.away?.id ?? 0,
      name: gameData?.teams?.away?.name ?? 'Away',
      abbreviation: gameData?.teams?.away?.abbreviation ?? 'AWY',
      score: ls?.teams?.away?.runs ?? 0,
    };
    const homeTeam: TeamInfo = {
      id: gameData?.teams?.home?.id ?? 0,
      name: gameData?.teams?.home?.name ?? 'Home',
      abbreviation: gameData?.teams?.home?.abbreviation ?? 'HME',
      score: ls?.teams?.home?.runs ?? 0,
    };

    // Extract current batter id early so we can ensure they're in the predictions list
    const currentBatterId = (() => {
      try {
        const ld = rawFeed.liveData as { plays?: { currentPlay?: { matchup?: { batter?: { id?: number } } } } } | undefined;
        return ld?.plays?.currentPlay?.matchup?.batter?.id ?? null;
      } catch { return null; }
    })();

    // Include both teams — split by teamId so one team can't crowd out the other
    const homePlayers = homeTeam.id ? players.filter(p => p.teamId === homeTeam.id) : [];
    const awayPlayers = awayTeam.id ? players.filter(p => p.teamId === awayTeam.id) : [];
    let topPlayers = [...homePlayers.slice(0, 16), ...awayPlayers.slice(0, 16)];
    if (currentBatterId && !topPlayers.some(p => p.playerId === currentBatterId)) {
      const batterPlayer = players.find(p => p.playerId === currentBatterId);
      if (batterPlayer) topPlayers = [...topPlayers, batterPlayer];
    }

    const predictions = await Promise.all(
      topPlayers.map(async (player) => {
        const priceSummary = await getPlayerCardPricing(player.playerId, player.playerName, player.debutYear);
        return generateCardPrediction(player, priceSummary);
      })
    );

    const liveMatchup = buildLiveMatchup(rawFeed);

    return NextResponse.json({
      predictions,
      awayTeam,
      homeTeam,
      isLive,
      inning,
      outs,
      liveMatchup,
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
      outs: 0,
      liveMatchup: null,
      playerCount: 0,
    }, { status: 500 });
  }
}
