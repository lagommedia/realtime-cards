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

        players.push({
          playerId: player.person.id,
          playerName: player.person.fullName,
          teamId,
          position: player.position?.abbreviation ?? 'N/A',
          debutYear,
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
