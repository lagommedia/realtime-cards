import { NextRequest, NextResponse } from 'next/server';
import { calculateHof, RawCareerStats } from '@/lib/hof-probability';

const MLB_BASE = 'https://statsapi.mlb.com/api/v1';

interface StatSplit {
  stat: Record<string, string | number | undefined>;
}
interface StatBlock {
  type: { displayName: string };
  group: { displayName: string };
  splits: StatSplit[];
}
interface MlbPerson {
  fullName: string;
  currentAge: number;
  primaryPosition: { type: string; abbreviation: string };
  mlbDebutDate?: string;
  stats?: StatBlock[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const { playerId } = await params;
  const id = parseInt(playerId, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  try {
    const res = await fetch(
      `${MLB_BASE}/people/${id}?hydrate=stats(group=[hitting,pitching],type=career)&sportId=1`,
      { next: { revalidate: 86400 }, headers: { Accept: 'application/json' } },
    );
    if (!res.ok) throw new Error(`MLB ${res.status}`);
    const data: { people: MlbPerson[] } = await res.json();

    const person = data.people?.[0];
    if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const age = person.currentAge ?? 25;
    const debutYear = person.mlbDebutDate
      ? parseInt(person.mlbDebutDate.slice(0, 4), 10)
      : new Date().getFullYear();
    const pos = person.primaryPosition?.type ?? '';
    const abbr = person.primaryPosition?.abbreviation ?? '';
    const isPitcher = pos === 'Pitcher' || abbr === 'P' || abbr === 'SP' || abbr === 'RP';

    // Keep hitting and pitching career stats separate to avoid gamesPlayed overwrite
    // (e.g. Ohtani's pitching gamesPlayed ~130 must not clobber his batting gamesPlayed ~900)
    const hit: Record<string, string | number | undefined> = {};
    const pit: Record<string, string | number | undefined> = {};
    for (const block of person.stats ?? []) {
      if (block.type?.displayName !== 'career') continue;
      const split = block.splits?.[0]?.stat;
      if (!split) continue;
      if (block.group?.displayName === 'hitting') Object.assign(hit, split);
      else if (block.group?.displayName === 'pitching') Object.assign(pit, split);
    }

    const career: RawCareerStats = {
      gamesPlayed:    Number((isPitcher ? pit : hit).gamesPlayed ?? 0),
      hits:           Number(hit.hits            ?? 0),
      homeRuns:       Number(hit.homeRuns        ?? 0),
      rbi:            Number(hit.rbi             ?? 0),
      avg:            parseFloat(String(hit.avg  ?? '0')),
      ops:            parseFloat(String(hit.ops  ?? '0')),
      wins:           Number(pit.wins            ?? 0),
      era:            parseFloat(String(pit.era  ?? '9.99')),
      strikeOuts:     Number(pit.strikeOuts      ?? 0),
      whip:           parseFloat(String(pit.whip ?? '2.99')),
      inningsPitched: String(pit.inningsPitched  ?? '0'),
    };

    const result = calculateHof(career, age, debutYear, isPitcher);
    return NextResponse.json({ ...result, playerName: person.fullName, age });
  } catch (err) {
    console.error('HOF route error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
