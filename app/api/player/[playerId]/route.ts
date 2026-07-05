import { NextRequest, NextResponse } from 'next/server';
import { getPlayerStats } from '@/lib/mlb-api';
import { getPlayerCardPricing } from '@/lib/ebay-api';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params;
    const id = parseInt(playerId, 10);
    const [playerData, pricing] = await Promise.all([
      getPlayerStats(id),
      getPlayerCardPricing(id, `Player ${id}`),
    ]);
    return NextResponse.json({ player: playerData, pricing });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch player data' }, { status: 500 });
  }
}
