import { NextRequest, NextResponse } from 'next/server';

const MLB_BASE = 'https://statsapi.mlb.com/api/v1';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ people: [] });

  try {
    const res = await fetch(
      `${MLB_BASE}/people/search?names=${encodeURIComponent(q)}&sportId=1&limit=10`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return NextResponse.json({ people: [] });
    const data = await res.json() as {
      people?: {
        id: number;
        fullName: string;
        currentTeam?: { id: number; name: string };
        primaryPosition?: { name: string; abbreviation: string };
      }[];
    };
    return NextResponse.json({ people: data.people ?? [] });
  } catch {
    return NextResponse.json({ people: [] });
  }
}
