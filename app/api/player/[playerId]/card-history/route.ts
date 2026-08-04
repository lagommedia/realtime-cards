import { NextRequest, NextResponse } from 'next/server';
import { getPriceHistory, getForecast } from '@/lib/card-price-db';
import { getCardSoldHistory } from '@/lib/card-api';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> },
) {
  await params;
  const q = req.nextUrl.searchParams.get('q') ?? '';
  if (!q) return NextResponse.json({ points: [], forecast: [] });

  try {
    // Always load forecast (empty array if none generated yet)
    const forecast = await getForecast(q);

    // 1. DB first — dense, growing data from the daily cron
    const dbPoints = await getPriceHistory(q);
    if (dbPoints.length > 0) {
      return NextResponse.json({ points: dbPoints, forecast, source: 'db' }, {
        headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
      });
    }

    // 2. Fall back to live Card API when DB has no history yet
    const livePoints = await getCardSoldHistory(q);
    return NextResponse.json({ points: livePoints, forecast, source: 'live' }, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    });
  } catch {
    return NextResponse.json({ points: [], forecast: [] });
  }
}
