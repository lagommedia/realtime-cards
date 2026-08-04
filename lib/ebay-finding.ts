/**
 * eBay Finding API client for fetching completed/sold card listings.
 *
 * Key facts:
 *  - Uses EBAY_CLIENT_ID only (no OAuth needed)
 *  - Can return up to 10,000 results per query (100 items × 100 pages)
 *  - Hard date limit: 90 days back from today — no eBay API goes further
 *  - Category 212 = Sports Trading Cards
 */

const FINDING_ENDPOINT =
  'https://svcs.ebay.com/services/search/FindingService/v1';

export interface FoundSale {
  ebayItemId: string;
  title: string;
  salePrice: number;
  saleDate: string; // YYYY-MM-DD
}

interface FindingResponse {
  findCompletedItemsResponse?: Array<{
    ack?: string[];
    paginationOutput?: Array<{
      totalPages?: string[];
      totalEntries?: string[];
    }>;
    searchResult?: Array<{
      '@count'?: string;
      item?: Array<{
        itemId?: string[];
        title?: string[];
        sellingStatus?: Array<{
          currentPrice?: Array<{ __value__: string }>;
          sellingState?: Array<{ __value__: string }>;
        }>;
        listingInfo?: Array<{
          endTime?: string[];
        }>;
      }>;
    }>;
  }>;
}

/**
 * Fetch all sold eBay listings matching `query` within the given date window.
 * Automatically paginates up to `maxPages` (default 100 → 10,000 results).
 *
 * fromDate/toDate default to [90 days ago … now], which is the maximum
 * window the Finding API supports.
 */
export async function fetchAllSoldListings(
  query: string,
  options: {
    fromDate?: Date;
    toDate?: Date;
    maxPages?: number;
  } = {},
): Promise<FoundSale[]> {
  const appId = process.env.EBAY_CLIENT_ID;
  if (!appId) return [];

  const now = new Date();
  const {
    fromDate = new Date(now.getTime() - 90 * 86400000),
    toDate = now,
    maxPages = 100,
  } = options;

  const results: FoundSale[] = [];
  let filterIdx = 1; // itemFilter(0) = SoldItemsOnly

  // Build static filters
  const staticFilters: Record<string, string> = {
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': appId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    keywords: query,
    categoryId: '212',
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    [`itemFilter(${filterIdx}).name`]: 'EndTimeFrom',
    [`itemFilter(${filterIdx}).value`]: fromDate.toISOString(),
    [`itemFilter(${filterIdx + 1}).name`]: 'EndTimeTo',
    [`itemFilter(${filterIdx + 1}).value`]: toDate.toISOString(),
    sortOrder: 'EndTimeSoonest',
    'paginationInput.entriesPerPage': '100',
  };

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      ...staticFilters,
      'paginationInput.pageNumber': String(page),
    });

    const res = await fetch(`${FINDING_ENDPOINT}?${params}`, {
      cache: 'no-store',
    }).catch(() => null);

    if (!res?.ok) break;

    const data = await res.json() as FindingResponse;
    const resp = data.findCompletedItemsResponse?.[0];
    if (!resp || resp.ack?.[0] !== 'Success') break;

    const items = resp.searchResult?.[0]?.item ?? [];

    for (const item of items) {
      const state = item.sellingStatus?.[0]?.sellingState?.[0]?.__value__ ?? '';
      if (state !== 'EndedWithSales') continue;

      const priceStr = item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__;
      const endTime  = item.listingInfo?.[0]?.endTime?.[0];
      const itemId   = item.itemId?.[0];
      const title    = item.title?.[0] ?? '';

      if (!priceStr || !endTime || !itemId) continue;
      const price = parseFloat(priceStr);
      if (price <= 0) continue;

      results.push({
        ebayItemId: itemId,
        title,
        salePrice: price,
        saleDate: endTime.slice(0, 10),
      });
    }

    const totalPages = parseInt(
      resp.paginationOutput?.[0]?.totalPages?.[0] ?? '1',
      10,
    );
    if (page >= totalPages) break;

    // Gentle rate limiting — Finding API allows ~5,000 calls/day
    await new Promise(r => setTimeout(r, 150));
  }

  return results;
}
