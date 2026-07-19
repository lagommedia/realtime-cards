import { MLBGame, MLBPlayer, MLBTeam, LivePlayerStat, GameEvent } from '@/types';

export interface ScheduledGame { gamePk: number; date: string; }

const MLB_BASE = 'https://statsapi.mlb.com/api/v1';
const MLB_BASE_V1_1 = 'https://statsapi.mlb.com/api/v1.1';

async function fetchMLB<T>(path: string, version = 'v1', cacheSeconds = 30): Promise<T> {
  const base = version === 'v1.1' ? MLB_BASE_V1_1 : MLB_BASE;
  const res = await fetch(`${base}${path}`, {
    ...(cacheSeconds === 0
      ? { cache: 'no-store' }
      : { next: { revalidate: cacheSeconds } }),
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`MLB API error: ${res.status}`);
  return res.json();
}

export async function getTodayGames(): Promise<MLBGame[]> {
  // MLB schedules games by Eastern date, not UTC.
  // After midnight ET, West Coast games started "yesterday" (ET) are still live —
  // so we always fetch both the current ET date and the previous ET date, keeping
  // only still-Live games from the prior date to cover those late-night windows.
  const etNow = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const etYesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  const fetchDate = (date: string) =>
    fetchMLB<{ dates: Array<{ games: MLBGame[] }> }>(
      `/schedule?sportId=1&date=${date}&hydrate=team,linescore,flags`,
      'v1',
      0
    ).then(d => d.dates?.[0]?.games ?? []);

  const [todayGames, yesterdayGames] = await Promise.all([
    fetchDate(etNow),
    fetchDate(etYesterday),
  ]);

  // After midnight ET, carry over yesterday's games that are still Live (West Coast late games).
  // Final games from yesterday belong to a different calendar date — exclude them so "Finished Today"
  // only shows games that completed on today's date.
  const carryover = yesterdayGames.filter(g => g.status.abstractGameState === 'Live');
  return [...carryover, ...todayGames];
}

export async function getLiveGameFeed(gamePk: number) {
  const data = await fetchMLB<{ liveData: unknown; gameData: unknown }>(
    `/game/${gamePk}/feed/live`,
    'v1.1',
    0  // no server-side cache — always fetch fresh from MLB
  );
  return data;
}

export async function getGameBoxScore(gamePk: number) {
  const data = await fetchMLB<{ teams: { home: unknown; away: unknown } }>(
    `/game/${gamePk}/boxscore`
  );
  return data;
}

export async function getTeamRoster(teamId: number): Promise<MLBPlayer[]> {
  const data = await fetchMLB<{ roster: Array<{ person: MLBPlayer; position: { name: string; abbreviation: string } }> }>(
    `/teams/${teamId}/roster?rosterType=active`
  );
  return data.roster?.map(r => ({
    ...r.person,
    primaryPosition: r.position,
  })) ?? [];
}

export async function getPlayerStats(playerId: number): Promise<MLBPlayer> {
  const data = await fetchMLB<{ people: MLBPlayer[] }>(
    `/people/${playerId}?hydrate=stats(group=[hitting,pitching],type=season)`
  );
  return data.people?.[0];
}

export async function getAllTeams(): Promise<MLBTeam[]> {
  const data = await fetchMLB<{ teams: MLBTeam[] }>('/teams?sportId=1');
  return data.teams ?? [];
}

// ── Historical / multi-game helpers ──────────────────────────────────────────

export async function getScheduleForDateRange(startDate: string, endDate: string): Promise<ScheduledGame[]> {
  const data = await fetchMLB<{
    dates: Array<{ date: string; games: Array<{ gamePk: number; status: { abstractGameState: string } }> }>
  }>(`/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&gameType=R`, 'v1', 3600);
  const games: ScheduledGame[] = [];
  for (const dateEntry of data.dates ?? []) {
    for (const game of dateEntry.games) {
      if (game.status.abstractGameState === 'Final') {
        games.push({ gamePk: game.gamePk, date: dateEntry.date });
      }
    }
  }
  return games;
}

async function getHistoricalBoxScore(gamePk: number) {
  return fetchMLB<{ teams: { home: unknown; away: unknown } }>(
    `/game/${gamePk}/boxscore`, 'v1', 86400
  );
}

type BoxscoreTeamPlayer = {
  person?: { id: number; fullName: string };
  position?: { abbreviation: string };
  stats?: {
    batting?: { atBats?: number; hits?: number; homeRuns?: number; rbi?: number; strikeOuts?: number; baseOnBalls?: number };
    pitching?: { inningsPitched?: string; strikeOuts?: number; earnedRuns?: number };
  };
};

function extractBoxscoreStats(boxscore: { teams: { home: unknown; away: unknown } }): LivePlayerStat[] {
  const players: LivePlayerStat[] = [];
  try {
    for (const side of ['home', 'away'] as const) {
      const team = (boxscore.teams as Record<string, unknown>)[side] as {
        team?: { id: number };
        players?: Record<string, BoxscoreTeamPlayer>;
      };
      const teamId = team?.team?.id ?? 0;
      for (const [, player] of Object.entries(team?.players ?? {})) {
        if (!player.person?.id) continue;
        const batting  = player.stats?.batting;
        const pitching = player.stats?.pitching;
        players.push({
          playerId:   player.person.id,
          playerName: player.person.fullName,
          teamId,
          position: player.position?.abbreviation ?? 'N/A',
          todayStats: {
            atBats:              batting?.atBats,
            hits:                batting?.hits,
            homeRuns:            batting?.homeRuns,
            rbi:                 batting?.rbi,
            strikeOuts:          batting?.strikeOuts,
            walks:               batting?.baseOnBalls,
            inningsPitched:      pitching?.inningsPitched,
            pitchingStrikeOuts:  pitching?.strikeOuts,
            earnedRuns:          pitching?.earnedRuns,
          },
        });
      }
    }
  } catch { /* partial results ok */ }
  return players;
}

function addInnings(a: string | undefined, b: string | undefined): string {
  const parse = (s: string | undefined) => { const [w, f] = (s ?? '0').split('.').map(Number); return (w ?? 0) * 3 + (f ?? 0); };
  const total = parse(a) + parse(b);
  return `${Math.floor(total / 3)}.${total % 3}`;
}

function scoreHitterGame(stats: LivePlayerStat['todayStats']): { score: number; label: string } {
  const hrs = stats.homeRuns ?? 0;
  const hits = stats.hits ?? 0;
  const ab = stats.atBats ?? 0;
  const rbi = stats.rbi ?? 0;
  const parts: string[] = [];
  let score = hrs * 25 + hits * 5 + rbi * 8;
  if (hrs > 0) parts.push(`${hrs} HR`);
  if (hits > 0 && ab > 0) parts.push(`${hits}-${ab}`);
  if (rbi > 0) parts.push(`${rbi} RBI`);
  if (hits === 0 && ab >= 3) { score = -15; return { score, label: `0-for-${ab}` }; }
  return { score, label: parts.join(', ') };
}

function scorePitcherGame(stats: LivePlayerStat['todayStats']): { score: number; label: string } {
  const ks = stats.pitchingStrikeOuts ?? 0;
  const ip = parseFloat(stats.inningsPitched ?? '0');
  const er = stats.earnedRuns ?? 0;
  const score = ks * 4 + ip * 3 - er * 8;
  const parts: string[] = [];
  if (ip > 0) parts.push(`${ip} IP`);
  if (ks > 0) parts.push(`${ks} K`);
  if (stats.earnedRuns !== undefined) parts.push(`${er} ER`);
  return { score, label: parts.join(', ') };
}

export async function aggregatePlayerStatsFromGames(
  games: ScheduledGame[]
): Promise<{ players: LivePlayerStat[]; perGameEvents: Map<number, GameEvent[]> }> {
  if (games.length === 0) return { players: [], perGameEvents: new Map() };

  const results = await Promise.all(
    games.map(g => getHistoricalBoxScore(g.gamePk).catch(() => null).then(bs => bs ? { bs, date: g.date } : null))
  );

  const playerMap = new Map<number, LivePlayerStat>();
  // playerId → list of significant game events (unsorted)
  const rawEvents = new Map<number, Array<{ date: string; score: number; label: string; opponentTeamId: number }>>();

  for (const result of results) {
    if (!result) continue;
    const { bs, date } = result;
    const boxscore = bs as { teams: { home: unknown; away: unknown } };
    const stats = extractBoxscoreStats(boxscore);

    const homeTeamId = ((boxscore.teams as Record<string, unknown>).home as { team?: { id: number } })?.team?.id ?? 0;
    const awayTeamId = ((boxscore.teams as Record<string, unknown>).away as { team?: { id: number } })?.team?.id ?? 0;

    for (const stat of stats) {
      // Aggregate totals
      if (playerMap.has(stat.playerId)) {
        const e = playerMap.get(stat.playerId)!;
        const s = e.todayStats; const n = stat.todayStats;
        s.atBats             = (s.atBats             ?? 0) + (n.atBats             ?? 0);
        s.hits               = (s.hits               ?? 0) + (n.hits               ?? 0);
        s.homeRuns           = (s.homeRuns           ?? 0) + (n.homeRuns           ?? 0);
        s.rbi                = (s.rbi                ?? 0) + (n.rbi                ?? 0);
        s.strikeOuts         = (s.strikeOuts         ?? 0) + (n.strikeOuts         ?? 0);
        s.walks              = (s.walks              ?? 0) + (n.walks              ?? 0);
        s.pitchingStrikeOuts = (s.pitchingStrikeOuts ?? 0) + (n.pitchingStrikeOuts ?? 0);
        s.earnedRuns         = (s.earnedRuns         ?? 0) + (n.earnedRuns         ?? 0);
        s.inningsPitched     = addInnings(s.inningsPitched, n.inningsPitched);
      } else {
        playerMap.set(stat.playerId, { ...stat, todayStats: { ...stat.todayStats } });
      }

      // Score this game for event tracking
      const isPitcher = ['P', 'SP', 'RP', 'CP'].includes(stat.position);
      const { score, label } = isPitcher
        ? scorePitcherGame(stat.todayStats)
        : scoreHitterGame(stat.todayStats);

      if (Math.abs(score) >= 15 && label) {
        const opponentTeamId = stat.teamId === homeTeamId ? awayTeamId : homeTeamId;
        const existing = rawEvents.get(stat.playerId) ?? [];
        existing.push({ date, score, label, opponentTeamId });
        rawEvents.set(stat.playerId, existing);
      }
    }
  }

  // For each player, keep the top 4 most impactful games, sorted chronologically
  const perGameEvents = new Map<number, GameEvent[]>();
  for (const [playerId, events] of rawEvents) {
    const top4 = events
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
      .slice(0, 4)
      .sort((a, b) => a.date.localeCompare(b.date));
    perGameEvents.set(playerId, top4.map(e => ({
      date: e.date,
      label: e.label,
      impactScore: e.score,
      opponentTeamId: e.opponentTeamId || undefined,
    })));
  }

  return { players: [...playerMap.values()], perGameEvents };
}

export async function getSeasonStatsLeaders(): Promise<LivePlayerStat[]> {
  const season = new Date().getFullYear();

  type StatSplit = {
    player: { id: number; fullName: string };
    team?: { id: number };
    position?: { abbreviation: string };
    stat: {
      homeRuns?: number; rbi?: number; avg?: string;
      atBats?: number; hits?: number;
      strikeOuts?: number; inningsPitched?: string; earnedRuns?: number;
    };
  };
  type StatsResponse = { stats: Array<{ splits?: StatSplit[] }> };

  const [hitting, pitching] = await Promise.all([
    fetchMLB<StatsResponse>(
      `/stats?stats=season&group=hitting&season=${season}&gameType=R&limit=50&sportId=1`,
      'v1', 1800
    ).catch(() => null),
    fetchMLB<StatsResponse>(
      `/stats?stats=season&group=pitching&season=${season}&gameType=R&limit=30&sportId=1`,
      'v1', 1800
    ).catch(() => null),
  ]);

  const map = new Map<number, LivePlayerStat>();

  // Top hitters sorted by home runs
  const hitterSplits = (hitting?.stats ?? []).flatMap(s => s.splits ?? []);
  const topHitters = hitterSplits
    .filter(s => s.player?.id && (s.stat.homeRuns ?? 0) > 0)
    .sort((a, b) => (b.stat.homeRuns ?? 0) - (a.stat.homeRuns ?? 0))
    .slice(0, 12);

  for (const split of topHitters) {
    map.set(split.player.id, {
      playerId:   split.player.id,
      playerName: split.player.fullName,
      teamId:     split.team?.id ?? 0,
      position:   split.position?.abbreviation ?? 'OF',
      todayStats: {
        homeRuns: split.stat.homeRuns ?? 0,
        rbi:      split.stat.rbi ?? 0,
        avg:      split.stat.avg,
        atBats:   split.stat.atBats ?? 0,
        hits:     split.stat.hits ?? 0,
      },
    });
  }

  // Top pitchers sorted by strikeouts
  const pitcherSplits = (pitching?.stats ?? []).flatMap(s => s.splits ?? []);
  const topPitchers = pitcherSplits
    .filter(s => s.player?.id && (s.stat.strikeOuts ?? 0) > 0)
    .sort((a, b) => (b.stat.strikeOuts ?? 0) - (a.stat.strikeOuts ?? 0))
    .slice(0, 8);

  for (const split of topPitchers) {
    if (map.has(split.player.id)) continue;
    map.set(split.player.id, {
      playerId:   split.player.id,
      playerName: split.player.fullName,
      teamId:     split.team?.id ?? 0,
      position:   split.position?.abbreviation ?? 'SP',
      todayStats: {
        pitchingStrikeOuts: split.stat.strikeOuts ?? 0,
        inningsPitched:     split.stat.inningsPitched,
        earnedRuns:         split.stat.earnedRuns,
      },
    });
  }

  return [...map.values()];
}

export function extractLivePlayerStats(liveData: Record<string, unknown>): LivePlayerStat[] {
  const players: LivePlayerStat[] = [];
  try {
    const boxscore = (liveData as { liveData?: { boxscore?: { teams?: { home?: unknown; away?: unknown } } } })
      ?.liveData?.boxscore?.teams;
    if (!boxscore) return players;

    // gameData.players is keyed by "ID{playerId}" and includes mlbDebutDate
    const gamePlayers = (liveData as {
      gameData?: { players?: Record<string, { id?: number; mlbDebutDate?: string }> }
    })?.gameData?.players ?? {};

    for (const side of ['home', 'away'] as const) {
      const team = (boxscore as Record<string, unknown>)[side] as {
        team?: { id: number };
        players?: Record<string, {
          person?: { id: number; fullName: string };
          position?: { abbreviation: string };
          battingOrder?: string; // e.g. "100", "200"…"900"; first digit = lineup slot
          stats?: {
            batting?: {
              atBats?: number; hits?: number; homeRuns?: number;
              rbi?: number; strikeOuts?: number; baseOnBalls?: number; avg?: string;
            };
            pitching?: {
              inningsPitched?: string; strikeOuts?: number; earnedRuns?: number;
            };
          };
        }>;
      };
      const teamId = team?.team?.id ?? 0;

      for (const [, player] of Object.entries(team?.players ?? {})) {
        if (!player.person?.id) continue;
        const batting = player.stats?.batting;
        const pitching = player.stats?.pitching;

        const debutStr = gamePlayers[`ID${player.person.id}`]?.mlbDebutDate;
        const debutYear = debutStr ? parseInt(debutStr.split('-')[0], 10) : undefined;

        // battingOrder is "100"–"900"; first digit is the actual slot (1–9)
        const battingOrder = player.battingOrder
          ? Math.floor(parseInt(player.battingOrder, 10) / 100)
          : undefined;

        players.push({
          playerId: player.person.id,
          playerName: player.person.fullName,
          teamId,
          position: player.position?.abbreviation ?? 'N/A',
          debutYear,
          battingOrder: battingOrder && battingOrder > 0 ? battingOrder : undefined,
          todayStats: {
            atBats: batting?.atBats,
            hits: batting?.hits,
            homeRuns: batting?.homeRuns,
            rbi: batting?.rbi,
            strikeOuts: batting?.strikeOuts,
            walks: batting?.baseOnBalls,
            avg: batting?.avg,
            inningsPitched: pitching?.inningsPitched,
            pitchingStrikeOuts: pitching?.strikeOuts,
            earnedRuns: pitching?.earnedRuns,
          },
        });
      }
    }
  } catch {
    // return partial results on parse error
  }
  return players;
}
