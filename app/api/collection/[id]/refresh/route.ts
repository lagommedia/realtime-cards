import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { pool } from '@/lib/db';

// Client sends the newly-computed market value; we persist it and return updated priceHistory.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { currentValue } = await req.json() as { currentValue: number };

  const { rows } = await pool.query(
    `SELECT "priceHistory" FROM cards WHERE id = $1 AND "userId" = $2`,
    [id, session.user.id],
  );
  if (!rows.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const existing = Array.isArray(rows[0].priceHistory)
    ? rows[0].priceHistory
    : JSON.parse(rows[0].priceHistory ?? '[]');
  const priceHistory = [...existing, { date: now, value: currentValue }].slice(-90);

  await pool.query(
    `UPDATE cards
     SET "currentValue" = $1, "lastChecked" = $2, "priceHistory" = $3
     WHERE id = $4 AND "userId" = $5`,
    [currentValue, now, JSON.stringify(priceHistory), id, session.user.id],
  );

  return NextResponse.json({ ok: true, currentValue, lastChecked: now, priceHistory });
}
