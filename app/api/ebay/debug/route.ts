import { NextRequest, NextResponse } from 'next/server';

const EBAY_API_BASE = 'https://api.ebay.com';

export async function GET(req: NextRequest) {
  const name  = req.nextUrl.searchParams.get('name')  ?? 'Alex Bregman';
  const year  = req.nextUrl.searchParams.get('year')  ?? '2016';
  const grade = req.nextUrl.searchParams.get('grade') ?? '10';

  const clientId     = process.env.EBAY_CLIENT_ID     ?? '';
  const clientSecret = process.env.EBAY_CLIENT_SECRET ?? '';

  const steps: Record<string, unknown> = {
    credentials: {
      clientIdPresent:     clientId.length > 0,
      clientSecretPresent: clientSecret.length > 0,
      clientIdPrefix:      clientId.slice(0, 6) || '(empty)',
    },
  };

  // Step 1 — token
  if (!clientId || !clientSecret) {
    return NextResponse.json({ steps, error: 'No eBay credentials configured' });
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenRes = await fetch(`${EBAY_API_BASE}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    cache: 'no-store',
  });

  steps.tokenFetch = { status: tokenRes.status, ok: tokenRes.ok };

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    return NextResponse.json({ steps, error: 'Token fetch failed', tokenBody: body });
  }

  const tokenData = await tokenRes.json() as { access_token?: string; expires_in?: number; error?: string };
  steps.token = {
    hasAccessToken: !!tokenData.access_token,
    expiresIn:      tokenData.expires_in,
    error:          tokenData.error ?? null,
  };

  if (!tokenData.access_token) {
    return NextResponse.json({ steps, error: 'No access_token in response', tokenData });
  }

  const token = tokenData.access_token;

  // Step 2 — raw eBay search (no filters)
  const query    = `${name} ${year} Topps RC PSA ${grade}`;
  const endpoint = `/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&category_ids=212&limit=10&filter=buyingOptions:{FIXED_PRICE}`;

  const searchRes = await fetch(`${EBAY_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    },
    cache: 'no-store',
  });

  steps.searchFetch = { status: searchRes.status, ok: searchRes.ok, query };

  if (!searchRes.ok) {
    const body = await searchRes.text();
    return NextResponse.json({ steps, error: 'Search failed', searchBody: body });
  }

  const searchData = await searchRes.json() as {
    total?: number;
    itemSummaries?: Array<{ title: string; price?: { value: string }; itemWebUrl?: string }>;
    errors?: unknown;
  };

  steps.searchResults = {
    total:  searchData.total ?? 0,
    errors: searchData.errors ?? null,
    titles: (searchData.itemSummaries ?? []).map(i => i.title),
  };

  // Step 3 — apply our filters and show what passes/fails
  const NON_TOPPS = /\b(bowman|prizm|donruss|panini|select|optic|score|leaf|upper\s*deck|fleer|finest|heritage|stadium\s*club|gypsy|allen|archives|gallery|inception|luminance|mosaic|chronicles|national\s*treasure|immaculate|contenders?|playoff|triple\s*thread|topps\s*now|tier\s*one|five\s*star|dynasty|high\s*tek)\b/i;
  const SET_MAP = [
    { label: 'Chrome',   pattern: /\btopps\s+chrome\b/i },
    { label: 'Update',   pattern: /\btopps\s+update\b/i },
    { label: 'Series 2', pattern: /\btopps\s+series\s*(?:2|two)\b|\btopps\s+s2\b/i },
    { label: 'Series 1', pattern: /\btopps\s+series\s*(?:1|one)\b|\btopps\s+s1\b/i },
  ];

  const filterDiag = (searchData.itemSummaries ?? []).map(item => {
    const t = item.title;
    const reasons: string[] = [];
    if (NON_TOPPS.test(t))           reasons.push('non-Topps brand');
    if (!/\btopps\b/i.test(t))       reasons.push('no topps');
    if (!/\brc\b|\brookie\b/i.test(t)) reasons.push('no rc/rookie');
    if (!/\bpsa\b/i.test(t))         reasons.push('no psa');
    const setMatch = SET_MAP.find(s => s.pattern.test(t));
    if (!setMatch)                    reasons.push('no flagship set match');
    return { title: t, pass: reasons.length === 0, failReasons: reasons, set: setMatch?.label ?? null };
  });

  steps.filterDiag = filterDiag;

  return NextResponse.json({ steps });
}
