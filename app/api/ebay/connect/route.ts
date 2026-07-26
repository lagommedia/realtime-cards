import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/buy.order.readonly',
].join(' ');

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const ruName   = process.env.EBAY_RUNAME;

  if (!clientId || !ruName) {
    return NextResponse.json(
      { error: 'EBAY_CLIENT_ID or EBAY_RUNAME not configured' },
      { status: 503 },
    );
  }

  const url = new URL('https://auth.ebay.com/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', ruName);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('state', session.user.id); // Carry userId through to callback

  return NextResponse.redirect(url.toString());
}
