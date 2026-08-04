import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserEbayToken } from '@/lib/ebay-token';

export interface EbayOrderResult {
  orderId: string;
  itemId: string;
  title: string;
  price: number;
  date: string; // YYYY-MM-DD
}

type EbayLineItem = {
  legacyItemId?: string;
  title?: string;
  lineItemCost?: { value: string };
};

type EbayPurchaseOrder = {
  purchaseOrderId?: string;
  creationDate?: string;
  lineItems?: EbayLineItem[];
};

type EbayOrdersResponse = {
  purchaseOrders?: EbayPurchaseOrder[];
  errors?: Array<{ message: string }>;
};

// GET /api/ebay/recent-orders?q=Mike+Trout
// Returns the authenticated user's eBay orders from the last 90 days,
// filtered to those whose title contains all words in the query.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const query = req.nextUrl.searchParams.get('q')?.trim() ?? '';

  const token = await getUserEbayToken(session.user.id);
  if (!token) {
    return NextResponse.json({ error: 'ebay_not_connected' }, { status: 403 });
  }

  // eBay Buy Order API — last 200 orders (sufficient for most collectors)
  const apiRes = await fetch(
    'https://api.ebay.com/buy/order/v2/purchase_order?limit=200&fieldGroups=FULL',
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'X-EBAY-C-ENDUSERCTX': `contextualLocation=country=US`,
      },
      cache: 'no-store',
    },
  );

  if (!apiRes.ok) {
    const body = await apiRes.text();
    console.error('eBay recent-orders error:', apiRes.status, body);
    // 403 likely means scope not approved yet
    if (apiRes.status === 403) {
      return NextResponse.json({ error: 'scope_not_approved' }, { status: 403 });
    }
    return NextResponse.json({ error: 'ebay_api_error', status: apiRes.status }, { status: 502 });
  }

  const data = await apiRes.json() as EbayOrdersResponse;

  // Flatten orders → line items, then filter by query words
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);

  const results: EbayOrderResult[] = [];

  for (const order of data.purchaseOrders ?? []) {
    const dateStr = order.creationDate
      ? order.creationDate.slice(0, 10)
      : '';

    for (const item of order.lineItems ?? []) {
      const title = item.title ?? '';
      const titleLower = title.toLowerCase();

      // Keep only items whose title contains all query words
      if (queryWords.length > 0 && !queryWords.every(w => titleLower.includes(w))) continue;

      const price = item.lineItemCost?.value ? parseFloat(item.lineItemCost.value) : 0;

      results.push({
        orderId: order.purchaseOrderId ?? '',
        itemId:  item.legacyItemId ?? '',
        title,
        price,
        date: dateStr,
      });
    }
  }

  // Most recent first
  results.sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({ results });
}
