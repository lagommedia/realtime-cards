import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code   = searchParams.get('code');
  const userId = searchParams.get('state'); // passed through from /api/ebay/connect

  if (!code || !userId) {
    return NextResponse.redirect(new URL('/settings?ebay=error', req.nextUrl.origin));
  }

  const clientId     = process.env.EBAY_CLIENT_ID!;
  const clientSecret = process.env.EBAY_CLIENT_SECRET!;
  const ruName       = process.env.EBAY_RUNAME!;

  try {
    // Exchange authorization code for access + refresh tokens
    const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: ruName,
      }),
    });

    if (!tokenRes.ok) {
      console.error('eBay token exchange failed:', await tokenRes.text());
      return NextResponse.redirect(new URL('/settings?ebay=error', req.nextUrl.origin));
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Upsert — replace any existing connection for this user
    await pool.query(
      `INSERT INTO ebay_connections ("userId", access_token, refresh_token, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("userId") DO UPDATE
         SET access_token = EXCLUDED.access_token,
             refresh_token = EXCLUDED.refresh_token,
             expires_at = EXCLUDED.expires_at`,
      [userId, tokens.access_token, tokens.refresh_token, expiresAt],
    );

    return NextResponse.redirect(new URL('/settings?ebay=connected', req.nextUrl.origin));
  } catch (err) {
    console.error('eBay callback error:', err);
    return NextResponse.redirect(new URL('/settings?ebay=error', req.nextUrl.origin));
  }
}
