import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// Run once after deployment: GET /api/db/setup?secret=YOUR_SETUP_SECRET
// Set SETUP_SECRET in your env vars to protect this endpoint.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!process.env.SETUP_SECRET || secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Auth.js required tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        identifier TEXT NOT NULL,
        expires TIMESTAMPTZ NOT NULL,
        token TEXT NOT NULL,
        PRIMARY KEY (identifier, token)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT NOT NULL DEFAULT gen_random_uuid(),
        name TEXT,
        email TEXT UNIQUE,
        "emailVerified" TIMESTAMPTZ,
        image TEXT,
        password TEXT,
        PRIMARY KEY (id)
      );
    `);
    // Idempotent: add password column to existing tables
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT NOT NULL DEFAULT gen_random_uuid(),
        "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        provider TEXT NOT NULL,
        "providerAccountId" TEXT NOT NULL,
        refresh_token TEXT,
        access_token TEXT,
        expires_at BIGINT,
        id_token TEXT,
        scope TEXT,
        session_state TEXT,
        token_type TEXT,
        PRIMARY KEY (id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT NOT NULL DEFAULT gen_random_uuid(),
        "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires TIMESTAMPTZ NOT NULL,
        "sessionToken" TEXT NOT NULL UNIQUE,
        PRIMARY KEY (id)
      );
    `);

    // eBay OAuth tokens per user
    await client.query(`
      CREATE TABLE IF NOT EXISTS ebay_connections (
        id TEXT NOT NULL DEFAULT gen_random_uuid(),
        "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id),
        UNIQUE ("userId")
      );
    `);

    // Card collection per user
    await client.query(`
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT NOT NULL,
        "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "addedAt" TIMESTAMPTZ NOT NULL,
        "playerId" INTEGER NOT NULL,
        "playerName" TEXT NOT NULL,
        "teamId" INTEGER NOT NULL,
        position TEXT,
        year INTEGER,
        set TEXT,
        grade TEXT,
        variant TEXT,
        "purchasePrice" NUMERIC(10,2) NOT NULL,
        "purchaseDate" DATE NOT NULL,
        "photoDataUrl" TEXT,
        "photoBackDataUrl" TEXT,
        notes TEXT,
        "currentValue" NUMERIC(10,2),
        "lastChecked" TIMESTAMPTZ,
        "priceHistory" JSONB NOT NULL DEFAULT '[]',
        PRIMARY KEY (id)
      );
    `);

    await client.query('COMMIT');
    return NextResponse.json({ ok: true, message: 'Database schema created successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('DB setup error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    client.release();
  }
}
