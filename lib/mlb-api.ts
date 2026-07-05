import { MLBGame, MLBPlayer, MLBTeam, LivePlayerStat } from '@/types';

const MLB_BASE = 'https://statsapi.mlb.com/api/v1';
const MLB_BASE_V1_1 = 'https://statsapi.mlb.com/api/v1.1';

async function fetchMLB<T>(path: string, version = 'v1'): Promise<T> {
  const base = version === 'v1.1' ? MLB_BASE_V1_1 : MLB_BASE;
  const res = await fetch(`${base}${path}`, {
    next: { revalidate: 30 },
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`MLB API error: ${res.status}`);
  return res.json();
}

export async function getTodayGames(): Promise<MLBGame[]> {
  const today = new Date().toISOString().split('T')[0];
  const data = await fetchMLB<{ dates: Array<{ games: MLBGame[] }> }>(
    `/schedule?sportId=1&date=${today}&hydrate=team,linescore,flags`
  );
  return data.dates?.[0]?.games ?? [];
}

export async function getLiveGameFeed(gamePk: number) {
  const data = await fetchMLB<{ liveData: unknown; gameData: unknown }>(
    `/game/${gamePk}/feed/live`,
    'v1.1'
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
