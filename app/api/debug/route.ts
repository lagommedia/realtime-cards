import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint — shows raw eBay API response for a given player/year/set.
 * Usage: GET /api/debug?player=Jacob+Young&year=2023&set=Topps+Series+1
 * Remove this file before going to production permanently.
 */
export async function GET(req: NextRequest) {
  const player = req.nextUrl.searchParams.get('player') ?? 'Jacob Young';
  const year   = req.nextUrl.searchParams.get('year')   ?? '2023';
  const set    = req.nextUrl.searchParams.get('set')    ?? 'Topps Series 1';

  const clientId     = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      error: 'Missing credentials',
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
    });
  }

  // 1. Get token (no cache so we always get a fresh result here)
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    cache: 'no-store',
  });

  if (!tokenRes.ok) {
    return NextResponse.json({
      error: 'Token request failed',
      status: tokenRes.status,
      body: await tokenRes.text(),
    });
  }

  const { access_token: token } = await tokenRes.json() as { access_token: string };

  // 2. Search (no cache)
  const query = `${player} ${year} ${set} rookie card RC`;
  const searchRes = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&category_ids=212&limit=5`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    }
  );

  if (!searchRes.ok) {
    return NextResponse.json({
      error: 'Search request failed',
      status: searchRes.status,
      body: (await searchRes.text()).slice(0, 1000),
    });
  }

  const data = await searchRes.json() as { itemSummaries?: Record<string, unknown>[] };
  const items = data.itemSummaries ?? [];

  // 3. For first result, also fetch full item detail to compare
  let firstItemDetail: Record<string, unknown> | null = null;
  const firstId = items[0]?.itemId as string | undefined;
  if (firstId) {
    const detailRes = await fetch(
      `https://api.ebay.com/buy/browse/v1/item/${firstId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
        cache: 'no-store',
      }
    );
    if (detailRes.ok) {
      firstItemDetail = await detailRes.json() as Record<string, unknown>;
    }
  }

  return NextResponse.json({
    query,
    totalResults: items.length,
    summaryFields: items[0] ? Object.keys(items[0]) : [],
    items: items.map(item => ({
      title: item.title,
      itemId: item.itemId,
      image: item.image,
      thumbnailImages: item.thumbnailImages,
      additionalImages: item.additionalImages,
    })),
    firstItemDetailImageUrl: (firstItemDetail as { image?: { imageUrl?: string } } | null)?.image?.imageUrl ?? null,
    firstItemDetailFields: firstItemDetail ? Object.keys(firstItemDetail) : [],
  }, { headers: { 'Cache-Control': 'no-store' } });
}
