import { NextRequest, NextResponse } from 'next/server';
import { getPlayerStats } from '@/lib/mlb-api';
import { getPlayerCardPricing } from '@/lib/ebay-api';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const grading = req.nextUrl.searchParams.get('grading') ?? undefined;
  const grade   = req.nextUrl.searchParams.get('grade')   ?? undefined;
  try {
    const { playerId } = await params;
    const id = parseInt(playerId, 10);
    const [playerData, pricing] = await Promise.all([
      getPlayerStats(id),
      getPlayerCardPricing(id, `Player ${id}`, undefined, grading, grade),
    ]);
    return NextResponse.json({ player: playerData, pricing });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch player data' }, { status: 500 });
  }
}
