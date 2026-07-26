import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json() as {
    email: string;
    password: string;
    name?: string;
  };

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  const { rows } = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase().trim()],
  );
  if (rows.length > 0) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);
  const displayName = name?.trim() || email.split('@')[0];

  await pool.query(
    `INSERT INTO users (id, email, name, password)
     VALUES (gen_random_uuid(), $1, $2, $3)`,
    [email.toLowerCase().trim(), displayName, hashed],
  );

  return NextResponse.json({ ok: true });
}
