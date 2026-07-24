import { NextRequest, NextResponse } from 'next/server';
import { getCardSoldHistory } from '@/lib/ebay-history';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> },
) {
  await params;
  const q = req.nextUrl.searchParams.get('q') ?? '';
  if (!q) return NextResponse.json({ points: [] });

  try {
    const points = await getCardSoldHistory(q);
    return NextResponse.json({ points }, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    });
  } catch {
    return NextResponse.json({ points: [] });
  }
}
