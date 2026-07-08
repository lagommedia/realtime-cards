import { NextRequest, NextResponse } from 'next/server';
import { getPlayerCardSets } from '@/lib/ebay-api';

export const revalidate = 300; // cache full route response for 5 min

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> },
) {
  await params; // resolve dynamic segment (unused but required by Next.js)
  const name    = req.nextUrl.searchParams.get('name')    ?? '';
  const year    = parseInt(req.nextUrl.searchParams.get('year') ?? '0', 10);
  const grading = req.nextUrl.searchParams.get('grading') ?? undefined;
  const grade   = req.nextUrl.searchParams.get('grade')   ?? undefined;

  if (!name) return NextResponse.json({ sets: [] });

  try {
    const sets = await getPlayerCardSets(name, year, grading, grade);
    return NextResponse.json({ sets });
  } catch {
    return NextResponse.json({ sets: [] });
  }
}
