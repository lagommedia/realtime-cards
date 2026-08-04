import { NextRequest, NextResponse } from 'next/server';

// GET /api/ebay/item-lookup?itemId=123456789
// Uses app-level eBay token (no user auth needed) to look up an active listing's
// price and end date. Works for recent/active listings; completed sales won't be found.
export async function GET(req: NextRequest) {
  const itemId = req.nextUrl.searchParams.get('itemId')?.trim().replace(/\D/g, '');
  if (!itemId) return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });

  const clientId     = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'eBay not configured' }, { status: 503 });
  }

  // App token (client credentials)
  const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    cache: 'no-store',
  });
  if (!tokenRes.ok) return NextResponse.json({ error: 'eBay auth failed' }, { status: 502 });
  const { access_token } = await tokenRes.json() as { access_token: string };

  // Browse API item lookup — format: v1|{itemId}|0
  const itemRes = await fetch(`https://api.ebay.com/buy/browse/v1/item/v1|${itemId}|0`, {
    headers: {
      Authorization: `Bearer ${access_token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    },
    cache: 'no-store',
  });

  if (!itemRes.ok) {
    // Browse API only serves active listings — fall back to Shopping API for completed/sold items
    const shoppingRes = await fetch(
      `https://open.api.ebay.com/shopping?callname=GetSingleItem&appid=${encodeURIComponent(clientId)}&ItemID=${encodeURIComponent(itemId)}&responseencoding=JSON&version=967`,
      { cache: 'no-store' },
    );
    if (!shoppingRes.ok) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const shopping = await shoppingRes.json() as {
      Ack?: string;
      Item?: {
        Title?: string;
        SellingStatus?: {
          ConvertedCurrentPrice?: { value?: string };
          CurrentPrice?: { value?: string };
          ListingStatus?: string;
        };
        ListingDetails?: { EndTime?: string };
        ConditionDisplayName?: string;
      };
    };
    if (shopping.Ack !== 'Success' || !shopping.Item) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const si = shopping.Item;
    const rawPrice = si.SellingStatus?.ConvertedCurrentPrice?.value ?? si.SellingStatus?.CurrentPrice?.value;
    return NextResponse.json({
      title:     si.Title ?? null,
      // ConvertedCurrentPrice for a completed listing is the hammer price — no tax/shipping
      price:     rawPrice ? parseFloat(rawPrice) : null,
      date:      si.ListingDetails?.EndTime?.slice(0, 10) ?? null,
      condition: si.ConditionDisplayName ?? null,
      source:    'completed',
    });
  }

  const item = await itemRes.json() as {
    title?: string;
    price?: { value: string; currency: string };
    itemEndDate?: string;
    itemCreationDate?: string;
    condition?: string;
    seller?: { username: string };
  };

  return NextResponse.json({
    title:  item.title   ?? null,
    price:  item.price?.value ? parseFloat(item.price.value) : null,
    // Use end date if available, otherwise creation date as a proxy for purchase date
    date:   (item.itemEndDate ?? item.itemCreationDate ?? '').slice(0, 10) || null,
    condition: item.condition ?? null,
    source: 'active',
  });
}
