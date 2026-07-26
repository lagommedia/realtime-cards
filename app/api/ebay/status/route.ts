import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { pool } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ connected: false });
  }

  const { rows } = await pool.query(
    `SELECT expires_at FROM ebay_connections WHERE "userId" = $1`,
    [session.user.id],
  );

  if (!rows.length) return NextResponse.json({ connected: false });

  const expiresAt = new Date(rows[0].expires_at);
  return NextResponse.json({
    connected: true,
    expiresAt: expiresAt.toISOString(),
    expired: expiresAt < new Date(),
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await pool.query(
    `DELETE FROM ebay_connections WHERE "userId" = $1`,
    [session.user.id],
  );

  return NextResponse.json({ ok: true });
}
