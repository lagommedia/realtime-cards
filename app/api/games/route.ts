import { NextResponse } from 'next/server';
import { getTodayGames } from '@/lib/mlb-api';

export async function GET() {
  try {
    const games = await getTodayGames();
    return NextResponse.json({ games });
  } catch {
    return NextResponse.json({ games: [] });
  }
}
