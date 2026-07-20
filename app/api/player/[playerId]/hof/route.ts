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
      { next: { revalidate: 3600 }, headers: { Accept: 'application/json' } },
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

    // Merge all career stat splits into one flat object
    const flat: Record<string, string | number | undefined> = {};
    for (const block of person.stats ?? []) {
      if (block.type?.displayName !== 'career') continue;
      const split = block.splits?.[0]?.stat;
      if (split) Object.assign(flat, split);
    }

    const career: RawCareerStats = {
      gamesPlayed:    Number(flat.gamesPlayed    ?? 0),
      hits:           Number(flat.hits            ?? 0),
      homeRuns:       Number(flat.homeRuns        ?? 0),
      rbi:            Number(flat.rbi             ?? 0),
      avg:            parseFloat(String(flat.avg  ?? '0')),
      ops:            parseFloat(String(flat.ops  ?? '0')),
      wins:           Number(flat.wins            ?? 0),
      era:            parseFloat(String(flat.era  ?? '9.99')),
      strikeOuts:     Number(flat.strikeOuts      ?? 0),
      whip:           parseFloat(String(flat.whip ?? '2.99')),
      inningsPitched: String(flat.inningsPitched  ?? '0'),
    };

    const result = calculateHof(career, age, debutYear, isPitcher);
    return NextResponse.json({ ...result, playerName: person.fullName, age });
  } catch (err) {
    console.error('HOF route error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
