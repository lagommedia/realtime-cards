import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { pool } from '@/lib/db';
import type { CollectionCard } from '@/context/CollectionContext';

type CardRow = Record<string, unknown>;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { rows } = await pool.query(
    `SELECT * FROM cards WHERE "userId" = $1 ORDER BY "addedAt" DESC`,
    [session.user.id],
  );

  const cards = rows.map(normalise);
  return NextResponse.json({ cards });
}

type CardPayload = CollectionCard;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await req.json() as CardPayload;
  const id = crypto.randomUUID();
  const addedAt = new Date().toISOString();

  await pool.query(
    `INSERT INTO cards (
      id, "userId", "addedAt", "playerId", "playerName", "teamId", position,
      year, set, grade, variant, "purchasePrice", "purchaseDate",
      "photoDataUrl", "photoBackDataUrl", notes,
      "currentValue", "lastChecked", "priceHistory"
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
    )`,
    [
      id, session.user.id, addedAt,
      data.playerId, data.playerName, data.teamId, data.position,
      data.year ?? null, data.set ?? null, data.grade ?? null, data.variant ?? null,
      data.purchasePrice, data.purchaseDate,
      data.photoDataUrl ?? null, data.photoBackDataUrl ?? null, data.notes ?? null,
      data.currentValue ?? null, data.lastChecked ?? null,
      JSON.stringify(data.priceHistory ?? []),
    ],
  );

  const card: CollectionCard = {
    ...data,
    id,
    addedAt,
    currentValue: data.currentValue ?? null,
    lastChecked: data.lastChecked ?? null,
    priceHistory: data.priceHistory ?? [],
  };
  return NextResponse.json({ card }, { status: 201 });
}

function normalise(row: CardRow): CollectionCard {
  const base = row as unknown as CollectionCard;
  return {
    ...base,
    purchasePrice: Number(row.purchasePrice),
    currentValue: row.currentValue != null ? Number(row.currentValue) : null,
    priceHistory: Array.isArray(row.priceHistory)
      ? (row.priceHistory as { date: string; value: number }[])
      : (row.priceHistory ? JSON.parse(row.priceHistory as string) : []),
  };
}
