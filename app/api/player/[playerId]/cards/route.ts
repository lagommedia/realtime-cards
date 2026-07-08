import { NextRequest, NextResponse } from 'next/server';
import { getPlayerCardSets } from '@/lib/ebay-api';

// Cache successful results for 2 hours at the CDN edge — PSA 10 prices don't
// move that fast, and a long TTL means each unique player URL only hits eBay
// once per 2h across all users (not once per 5 min × many users).
// Empty results are returned with Cache-Control: no-store so clients always retry.
export const revalidate = 7200;

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache' };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> },
) {
  await params; // resolve dynamic segment (unused but required by Next.js)
  const name    = req.nextUrl.searchParams.get('name')    ?? '';
  const year    = parseInt(req.nextUrl.searchParams.get('year') ?? '0', 10);
  const grading = req.nextUrl.searchParams.get('grading') ?? undefined;
  const grade   = req.nextUrl.searchParams.get('grade')   ?? undefined;

  if (!name) return NextResponse.json({ sets: [] }, { headers: NO_CACHE });

  try {
    const sets = await getPlayerCardSets(name, year, grading, grade);
    // Only let Vercel's edge cache hold non-empty results. An empty response
    // means eBay was unavailable — the client should retry on the next request.
    if (sets.length === 0) return NextResponse.json({ sets: [] }, { headers: NO_CACHE });
    return NextResponse.json({ sets });
  } catch {
    return NextResponse.json({ sets: [] }, { headers: NO_CACHE });
  }
}
