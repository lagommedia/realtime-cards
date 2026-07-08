import { NextRequest, NextResponse } from 'next/server';
import { getPlayerCardSets } from '@/lib/ebay-api';

// Revalidate after 5 min, but empty results must not be CDN-cached — a transient
// eBay failure would block all retries for 5 minutes if we cached { sets: [] }.
export const revalidate = 300;

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
