import { NextRequest, NextResponse } from 'next/server';
import { getPlayerCardSets } from '@/lib/ebay-api';

// Do NOT cache at the CDN edge — the module-level _resultCache in ebay-api.ts
// handles per-instance deduplication. CDN caching survives deployments and would
// serve stale sorted results even after code changes.
export const dynamic = 'force-dynamic';

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
    const { sets, rateLimited } = await getPlayerCardSets(name, year, grading, grade);
    // Don't cache empty/rate-limited results at the CDN — the client must retry.
    if (sets.length === 0) return NextResponse.json({ sets: [], rateLimited }, { headers: NO_CACHE });
    return NextResponse.json({ sets, rateLimited: false });
  } catch {
    return NextResponse.json({ sets: [], rateLimited: false }, { headers: NO_CACHE });
  }
}
