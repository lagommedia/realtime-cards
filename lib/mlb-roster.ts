/**
 * Fetches all active MLB players for the current season via the MLB Stats API.
 * Results are cached in-memory for 24 hours to avoid repeated calls within
 * the same serverless process lifetime.
 */

export interface ActivePlayer {
  playerId: number;
  playerName: string;
  debutYear: number | null;
  position: string;
}

let _cache: { players: ActivePlayer[]; cachedAt: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function getActivePlayers(): Promise<ActivePlayer[]> {
  if (_cache && Date.now() - _cache.cachedAt < CACHE_TTL_MS) {
    return _cache.players;
  }

  const season = new Date().getFullYear();
  const url = `https://statsapi.mlb.com/api/v1/sports/1/players?season=${season}&gameType=R`;

  const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
  if (!res?.ok) {
    console.error('[mlb-roster] failed to fetch active players', res?.status);
    return _cache?.players ?? [];
  }

  const data = await res.json() as {
    people?: Array<{
      id: number;
      fullName: string;
      mlbDebutDate?: string;
      primaryPosition?: { abbreviation?: string };
    }>;
  };

  const players: ActivePlayer[] = (data.people ?? []).map(p => ({
    playerId:   p.id,
    playerName: p.fullName,
    debutYear:  p.mlbDebutDate ? new Date(p.mlbDebutDate).getFullYear() : null,
    position:   p.primaryPosition?.abbreviation ?? 'UNKN',
  }));

  _cache = { players, cachedAt: Date.now() };
  return players;
}
