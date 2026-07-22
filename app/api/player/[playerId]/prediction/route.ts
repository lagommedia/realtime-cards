import { NextRequest, NextResponse } from 'next/server';
import { getPlayerCardPricing } from '@/lib/ebay-api';
import { generateCardPrediction } from '@/lib/predictions';
import { LivePlayerStat } from '@/types';

const MLB_BASE = 'https://statsapi.mlb.com/api/v1';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const grading = req.nextUrl.searchParams.get('grading') ?? undefined;
  const grade   = req.nextUrl.searchParams.get('grade')   ?? undefined;

  const { playerId } = await params;
  const id = parseInt(playerId, 10);

  const season = new Date().getFullYear();
  const res = await fetch(
    `${MLB_BASE}/people/${id}?hydrate=stats(group=[hitting,pitching],type=season,season=${season})`,
    { next: { revalidate: 3600 } }
  );
  const data = await res.json() as {
    people?: Array<{
      fullName?: string;
      mlbDebutDate?: string;
      currentTeam?: { id: number };
      primaryPosition?: { abbreviation: string };
      stats?: Array<{
        group?: { displayName: string };
        splits?: Array<{ stat: Record<string, unknown> }>;
      }>;
    }>;
  };

  const person = data.people?.[0];
  if (!person) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  const name      = person.fullName ?? `Player ${id}`;
  const teamId    = person.currentTeam?.id ?? 0;
  const position  = person.primaryPosition?.abbreviation ?? 'OF';
  const debutYear = person.mlbDebutDate
    ? new Date(person.mlbDebutDate).getFullYear()
    : undefined;

  let todayStats: LivePlayerStat['todayStats'] = {};
  for (const group of person.stats ?? []) {
    const stat = group.splits?.[0]?.stat;
    if (!stat) continue;
    if (group.group?.displayName === 'hitting') {
      todayStats = {
        homeRuns:   (stat.homeRuns   as number)  ?? 0,
        rbi:        (stat.rbi        as number)  ?? 0,
        avg:        (stat.avg        as string)  ?? undefined,
        atBats:     (stat.atBats     as number)  ?? 0,
        hits:       (stat.hits       as number)  ?? 0,
        strikeOuts: (stat.strikeOuts as number)  ?? 0,
        walks:      (stat.baseOnBalls as number) ?? 0,
      };
    } else if (group.group?.displayName === 'pitching') {
      todayStats = {
        ...todayStats,
        inningsPitched:     (stat.inningsPitched     as string) ?? undefined,
        pitchingStrikeOuts: (stat.strikeOuts         as number) ?? 0,
        earnedRuns:         (stat.earnedRuns         as number) ?? 0,
      };
    }
  }

  const player: LivePlayerStat = { playerId: id, playerName: name, teamId, position, debutYear, todayStats };
  const priceSummary = await getPlayerCardPricing(id, name, debutYear, grading, grade);
  const prediction = generateCardPrediction(player, priceSummary, 'season');

  return NextResponse.json(prediction);
}
