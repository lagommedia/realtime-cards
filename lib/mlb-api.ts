import { MLBGame, MLBPlayer, MLBTeam, LivePlayerStat } from '@/types';

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

  // After midnight ET, carry over yesterday's games that are Live (still in progress)
  // or Final (completed late — so users can still see results). Skip Preview (postponed etc.)
  const carryover = yesterdayGames.filter(g => g.status.abstractGameState !== 'Preview');
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

export async function getScheduleForDateRange(startDate: string, endDate: string): Promise<number[]> {
  const data = await fetchMLB<{
    dates: Array<{ games: Array<{ gamePk: number; status: { abstractGameState: string } }> }>
  }>(`/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&gameType=R`, 'v1', 3600);
  const pks: number[] = [];
  for (const date of data.dates ?? []) {
    for (const game of date.games) {
      if (game.status.abstractGameState === 'Final') pks.push(game.gamePk);
    }
  }
  return pks;
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

export async function aggregatePlayerStatsFromGames(gamePks: number[]): Promise<LivePlayerStat[]> {
  if (gamePks.length === 0) return [];
  const boxscores = await Promise.all(gamePks.map(pk => getHistoricalBoxScore(pk).catch(() => null)));
  const map = new Map<number, LivePlayerStat>();
  for (const bs of boxscores) {
    if (!bs) continue;
    for (const stat of extractBoxscoreStats(bs as { teams: { home: unknown; away: unknown } })) {
      if (map.has(stat.playerId)) {
        const e = map.get(stat.playerId)!;
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
        map.set(stat.playerId, { ...stat, todayStats: { ...stat.todayStats } });
      }
    }
  }
  return [...map.values()];
}

export async function getSeasonStatsLeaders(): Promise<LivePlayerStat[]> {
  const season = new Date().getFullYear();
  type LeaderEntry = { person: { id: number; fullName: string }; team: { id: number }; value: string };
  type LeadersResponse = { leagueLeaders: Array<{ leaderCategory: string; leaders: LeaderEntry[] }> };

  const [hitting, pitching] = await Promise.all([
    fetchMLB<LeadersResponse>(
      `/stats/leaders?leaderCategories=homeRuns,rbi&season=${season}&leaderGameTypes=R&limit=12&sportId=1`,
      'v1', 1800
    ).catch(() => null),
    fetchMLB<LeadersResponse>(
      `/stats/leaders?leaderCategories=strikeouts&season=${season}&leaderGameTypes=R&limit=10&sportId=1&statGroup=pitching`,
      'v1', 1800
    ).catch(() => null),
  ]);

  const map = new Map<number, LivePlayerStat>();
  const add = (entry: LeaderEntry, stats: LivePlayerStat['todayStats'], position: string) => {
    if (!map.has(entry.person.id)) {
      map.set(entry.person.id, {
        playerId:   entry.person.id,
        playerName: entry.person.fullName,
        teamId:     entry.team?.id ?? 0,
        position,
        todayStats: stats,
      });
    } else {
      Object.assign(map.get(entry.person.id)!.todayStats, stats);
    }
  };

  for (const bucket of hitting?.leagueLeaders ?? []) {
    for (const l of bucket.leaders ?? []) {
      if (bucket.leaderCategory === 'homeRuns') add(l, { homeRuns: parseInt(l.value, 10) }, 'OF');
      if (bucket.leaderCategory === 'rbi')      add(l, { rbi:      parseInt(l.value, 10) }, 'OF');
    }
  }
  for (const bucket of pitching?.leagueLeaders ?? []) {
    for (const l of bucket.leaders ?? []) {
      add(l, { pitchingStrikeOuts: parseInt(l.value, 10) }, 'SP');
    }
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
