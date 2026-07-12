const MLB_BASE = 'https://statsapi.mlb.com/api/v1';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MilestoneType =
  | 'grand_slam'
  | 'cycle'
  | 'multi_hr'           // 2+ HR in one game
  | 'big_game_hits'      // 4+ hits
  | 'big_game_rbi'       // 5+ RBI
  | 'no_hitter'
  | 'perfect_game'
  | 'complete_game_shutout'
  | 'double_digit_k';    // 10+ strikeouts

export interface MilestoneEvent {
  type: MilestoneType;
  date: string;          // YYYY-MM-DD
  gamePk: number;
  description: string;
}

export interface GameLogStat {
  // Hitting
  atBats?: number;
  hits?: number;
  doubles?: number;
  triples?: number;
  homeRuns?: number;
  rbi?: number;
  grandSlams?: number;
  stolenBases?: number;
  strikeOuts?: number;
  // Pitching
  inningsPitched?: string;
  earnedRuns?: number;
  strikeOutsPitching?: number;
  hitsAllowed?: number;
  walksAllowed?: number;
  battersFaced?: number;
  completeGames?: number;
  shutouts?: number;
}

export interface SeasonSummary {
  year: number;
  gamesPlayed: number;
  milestones: MilestoneEvent[];
  // Hitting totals
  hits?: number;
  homeRuns?: number;
  rbi?: number;
  stolenBases?: number;
  battingAvg?: string;
  // Pitching totals
  era?: string;
  wins?: number;
  strikeOutsPitching?: number;
  inningsPitched?: string;
}

export interface PlayerHistoricalStats {
  playerId: number;
  playerName: string;
  isPitcher: boolean;
  debutYear: number;
  seasons: SeasonSummary[];
  allMilestones: MilestoneEvent[];   // flat list across all seasons, sorted by date
}

// ── MLB API types ─────────────────────────────────────────────────────────────

interface MLBGameLogSplit {
  date?: string;
  game?: { gamePk?: number };
  stat?: Record<string, number | string>;
}

interface MLBSeasonTotals {
  stat?: Record<string, number | string>;
  group?: { displayName?: string };
}

// ── Milestone detection ───────────────────────────────────────────────────────

function detectHittingMilestones(
  gamePk: number,
  date: string,
  s: Record<string, number | string>,
): MilestoneEvent[] {
  const milestones: MilestoneEvent[] = [];
  const hits      = Number(s.hits      ?? 0);
  const doubles   = Number(s.doubles   ?? 0);
  const triples   = Number(s.triples   ?? 0);
  const homeRuns  = Number(s.homeRuns  ?? 0);
  const rbi       = Number(s.rbi       ?? 0);
  const grandSlams = Number(s.grandSlams ?? 0);

  if (grandSlams > 0) {
    milestones.push({ type: 'grand_slam', date, gamePk, description: `Grand Slam (${grandSlams} GS)` });
  }

  const singles = hits - doubles - triples - homeRuns;
  if (singles >= 1 && doubles >= 1 && triples >= 1 && homeRuns >= 1) {
    milestones.push({ type: 'cycle', date, gamePk, description: 'Hit for the Cycle' });
  }

  if (homeRuns >= 2) {
    milestones.push({ type: 'multi_hr', date, gamePk, description: `${homeRuns}-HR game` });
  }

  if (hits >= 4) {
    milestones.push({ type: 'big_game_hits', date, gamePk, description: `${hits}-hit game` });
  }

  if (rbi >= 5) {
    milestones.push({ type: 'big_game_rbi', date, gamePk, description: `${rbi}-RBI game` });
  }

  return milestones;
}

function detectPitchingMilestones(
  gamePk: number,
  date: string,
  s: Record<string, number | string>,
): MilestoneEvent[] {
  const milestones: MilestoneEvent[] = [];
  const ip           = parseFloat(String(s.inningsPitched ?? '0'));
  const hitsAllowed  = Number(s.hits        ?? s.hitsAllowed  ?? 999);
  const walks        = Number(s.baseOnBalls ?? s.walksAllowed ?? 999);
  const ks           = Number(s.strikeOuts  ?? 0);
  const bf           = Number(s.battersFaced ?? 0);
  const cg           = Number(s.completeGames ?? 0);
  const sho          = Number(s.shutouts ?? 0);

  if (ip >= 9 && hitsAllowed === 0 && walks === 0 && bf === 27) {
    milestones.push({ type: 'perfect_game', date, gamePk, description: 'Perfect Game' });
  } else if (ip >= 9 && hitsAllowed === 0) {
    milestones.push({ type: 'no_hitter', date, gamePk, description: 'No-Hitter' });
  } else if (ip >= 9 && cg >= 1 && sho >= 1) {
    milestones.push({ type: 'complete_game_shutout', date, gamePk, description: 'Complete Game Shutout' });
  }

  if (ks >= 10) {
    milestones.push({ type: 'double_digit_k', date, gamePk, description: `${ks}-K game` });
  }

  return milestones;
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchIspitcher(playerId: number): Promise<{ isPitcher: boolean; name: string; debutYear: number }> {
  const res = await fetch(`${MLB_BASE}/people/${playerId}`, { next: { revalidate: 86400 } });
  if (!res.ok) return { isPitcher: false, name: '', debutYear: new Date().getFullYear() };
  const data = await res.json() as {
    people?: Array<{
      fullName?: string;
      mlbDebutDate?: string;
      primaryPosition?: { code?: string; type?: string };
    }>;
  };
  const person = data.people?.[0];
  const posCode = person?.primaryPosition?.code ?? '';
  const posType = person?.primaryPosition?.type ?? '';
  const isPitcher = posCode === '1' || posType === 'Pitcher';
  const debutYear = person?.mlbDebutDate
    ? new Date(person.mlbDebutDate).getFullYear()
    : new Date().getFullYear();
  return { isPitcher, name: person?.fullName ?? '', debutYear };
}

async function fetchSeasonGameLog(
  playerId: number,
  year: number,
  isPitcher: boolean,
): Promise<{ milestones: MilestoneEvent[]; summary: Omit<SeasonSummary, 'milestones'> }> {
  const group = isPitcher ? 'pitching' : 'hitting';

  // Game log for individual game stats
  const logUrl = `${MLB_BASE}/people/${playerId}/stats?stats=gameLog&group=${group}&season=${year}&gameType=R`;
  // Season totals for summary line
  const totalsUrl = `${MLB_BASE}/people/${playerId}/stats?stats=season&group=${group}&season=${year}&gameType=R`;

  const [logRes, totalsRes] = await Promise.allSettled([
    fetch(logUrl,    { next: { revalidate: 3600 } }),
    fetch(totalsUrl, { next: { revalidate: 3600 } }),
  ]);

  const milestones: MilestoneEvent[] = [];
  let gamesPlayed = 0;

  if (logRes.status === 'fulfilled' && logRes.value.ok) {
    const data = await logRes.value.json() as { stats?: Array<{ splits?: MLBGameLogSplit[] }> };
    const splits = data.stats?.[0]?.splits ?? [];
    gamesPlayed = splits.length;

    for (const split of splits) {
      const date   = split.date ?? '';
      const gamePk = split.game?.gamePk ?? 0;
      const stat   = (split.stat ?? {}) as Record<string, number | string>;
      const found  = isPitcher
        ? detectPitchingMilestones(gamePk, date, stat)
        : detectHittingMilestones(gamePk, date, stat);
      milestones.push(...found);
    }
  }

  const summary: Omit<SeasonSummary, 'milestones'> = { year, gamesPlayed };

  if (totalsRes.status === 'fulfilled' && totalsRes.value.ok) {
    const data = await totalsRes.value.json() as { stats?: MLBSeasonTotals[] };
    const s = (data.stats?.[0]?.stat ?? {}) as Record<string, number | string>;
    if (isPitcher) {
      summary.era              = String(s.era ?? '');
      summary.wins             = Number(s.wins ?? 0);
      summary.strikeOutsPitching = Number(s.strikeOuts ?? 0);
      summary.inningsPitched   = String(s.inningsPitched ?? '');
    } else {
      summary.hits         = Number(s.hits       ?? 0);
      summary.homeRuns     = Number(s.homeRuns   ?? 0);
      summary.rbi          = Number(s.rbi        ?? 0);
      summary.stolenBases  = Number(s.stolenBases ?? 0);
      summary.battingAvg   = String(s.avg        ?? '');
    }
  }

  return { milestones, summary };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches 3 seasons of game logs for a player, detects milestone events,
 * and returns a structured payload ready for Claude analysis.
 */
export async function getPlayerHistoricalStats(
  playerId: number,
  seasons: number[],
): Promise<PlayerHistoricalStats> {
  const { isPitcher, name, debutYear } = await fetchIspitcher(playerId);

  // Fetch seasons sequentially to avoid hammering the MLB API
  const seasonResults: SeasonSummary[] = [];
  for (const year of seasons) {
    if (year < debutYear) continue; // player hadn't debuted yet
    try {
      const { milestones, summary } = await fetchSeasonGameLog(playerId, year, isPitcher);
      seasonResults.push({ ...summary, milestones });
    } catch {
      // Season data unavailable — skip silently
    }
  }

  const allMilestones = seasonResults
    .flatMap(s => s.milestones)
    .sort((a, b) => a.date.localeCompare(b.date));

  return { playerId, playerName: name, isPitcher, debutYear, seasons: seasonResults, allMilestones };
}
