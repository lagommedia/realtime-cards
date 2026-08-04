import { pool } from './db';

// Returns a valid eBay access token for the given user, refreshing it automatically
// if it's within 5 minutes of expiry. Returns null if the user has no connection or
// if the refresh fails (e.g. token revoked or scope not approved).
export async function getUserEbayToken(userId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT access_token, refresh_token, expires_at FROM ebay_connections WHERE "userId" = $1`,
    [userId],
  );
  if (!rows.length) return null;

  const { access_token, refresh_token, expires_at } = rows[0] as {
    access_token: string;
    refresh_token: string;
    expires_at: string;
  };

  // Still valid (with 5-minute buffer)
  if (new Date(expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return access_token;
  }

  // Refresh
  const clientId     = process.env.EBAY_CLIENT_ID!;
  const clientSecret = process.env.EBAY_CLIENT_SECRET!;

  const refreshRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
    }),
    cache: 'no-store',
  });

  if (!refreshRes.ok) return null;

  const refreshed = await refreshRes.json() as {
    access_token?: string;
    expires_in?: number;
  };
  if (!refreshed.access_token) return null;

  const newExpiresAt = new Date(Date.now() + (refreshed.expires_in ?? 7200) * 1000).toISOString();

  await pool.query(
    `UPDATE ebay_connections SET access_token = $1, expires_at = $2 WHERE "userId" = $3`,
    [refreshed.access_token, newExpiresAt, userId],
  );

  return refreshed.access_token;
}
