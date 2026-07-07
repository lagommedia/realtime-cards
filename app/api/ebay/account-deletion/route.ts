import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

/**
 * eBay Marketplace Account Deletion endpoint.
 *
 * GET  — eBay sends a challenge_code to verify we own this URL.
 *         We respond with SHA-256(challengeCode + verificationToken + endpointUrl).
 * POST — eBay notifies us when an eBay user deletes their account.
 *         This app stores no eBay user data, so we just acknowledge.
 *
 * Setup in eBay Developer Portal → My Apps → Alerts & Notifications:
 *   Endpoint URL:      https://realtime-cards.vercel.app/api/ebay/account-deletion
 *   Verification token: (the value of EBAY_VERIFICATION_TOKEN env var)
 */

const ENDPOINT_URL = 'https://realtime-cards.vercel.app/api/ebay/account-deletion';

export async function GET(req: NextRequest) {
  const challengeCode = req.nextUrl.searchParams.get('challenge_code');
  if (!challengeCode) {
    return NextResponse.json({ error: 'Missing challenge_code' }, { status: 400 });
  }

  const verificationToken = process.env.EBAY_VERIFICATION_TOKEN;
  if (!verificationToken) {
    return NextResponse.json({ error: 'EBAY_VERIFICATION_TOKEN not configured' }, { status: 500 });
  }

  const challengeResponse = createHash('sha256')
    .update(challengeCode + verificationToken + ENDPOINT_URL)
    .digest('hex');

  return NextResponse.json({ challengeResponse });
}

export async function POST() {
  // No eBay user data is stored in this app — nothing to delete.
  return new NextResponse(null, { status: 200 });
}
