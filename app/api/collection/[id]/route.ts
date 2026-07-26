import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { pool } from '@/lib/db';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  await pool.query(
    `DELETE FROM cards WHERE id = $1 AND "userId" = $2`,
    [id, session.user.id],
  );

  return NextResponse.json({ ok: true });
}
