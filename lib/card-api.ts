/**
 * The Card API — real eBay sold prices for trading cards.
 * https://thecardapi.com/docs
 *
 * Free tier: 5,000 records/day, 3-day lookback.
 * Builder ($49/mo): 50,000 records/day, 30-day lookback.
 *
 * We run a daily cron that stores results in card_price_history,
 * so the DB grows indefinitely regardless of lookback window.
 */

const BASE = 'https://thecardapi.com/api/v1/market';

export interface CardSale {
  id: string;
  title: string;
  salePrice: number;
  saleDate: string;   // YYYY-MM-DD
  platform: string;
  grader: string | null;
  grade: string | null;
}

interface RawSale {
  id?: string;
  title?: string;
  price?: number;         // The Card API uses "price", not "sale_price"
  sale_date?: string;
  platform?: string;
  grader?: string | null;
  grade?: string | null;
}

interface SalesResponse {
  data?: RawSale[];
  pagination?: { next_cursor?: string | null };
}

// Parse "PSA 10" or "BGS 9.5" out of a free-text query so we can use
// the API's dedicated grade filters instead of embedding them in the search term.
function parseGradeFromQuery(query: string): {
  baseQuery: string;
  grader: string | undefined;
  grade: string | undefined;
} {
  const match = query.match(/\b(PSA|BGS|SGC|CGC|HGA|CSG|KSA)\s+(\d+(?:\.\d+)?)\b/i);
  if (!match) return { baseQuery: query, grader: undefined, grade: undefined };
  return {
    baseQuery: query.replace(match[0], '').replace(/\s+/g, ' ').trim(),
    grader: match[1].toUpperCase(),
    grade: match[2],
  };
}

/**
 * Fetch recent sold listings from The Card API for a given card query.
 * Automatically extracts grader/grade from the query string if present.
 *
 * @param query  e.g. "Trea Turner 2020 Topps Chrome PSA 10"
 * @param options.dateFrom  YYYY-MM-DD  (clamped to plan's lookback window)
 * @param options.limit     max records per request (1–1000)
 */
export async function fetchCardSales(
  query: string,
  options: { dateFrom?: string; dateTo?: string; limit?: number } = {},
): Promise<CardSale[]> {
  const apiKey = process.env.CARD_API_KEY;
  if (!apiKey) {
    console.error('[card-api] CARD_API_KEY not set');
    return [];
  }

  const { baseQuery, grader, grade } = parseGradeFromQuery(query);
  const limit = Math.min(options.limit ?? 200, 1000);

  const params = new URLSearchParams({ q: baseQuery, limit: String(limit), sort: 'date_desc' });
  if (grader) params.set('grader', grader);
  if (grade)  params.set('grade', grade);
  if (options.dateFrom) params.set('date_from', options.dateFrom);
  if (options.dateTo)   params.set('date_to',   options.dateTo);

  const allSales: CardSale[] = [];
  let cursor: string | null = null;
  let page = 0;
  const maxPages = 5; // stay well within rate limits

  do {
    const url = new URL(`${BASE}/sales`);
    url.search = params.toString();
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url.toString(), {
      headers: { 'x-market-api-key': apiKey },
      cache: 'no-store',
    }).catch(() => null);

    if (!res?.ok) {
      const body = await res?.text().catch(() => '') ?? '';
      console.error('[card-api] error', res?.status, body.slice(0, 200));
      break;
    }

    const json = await res.json() as SalesResponse;
    const records = json.data ?? [];

    for (const r of records) {
      if (!r.price || !r.sale_date) continue;
      allSales.push({
        id:        r.id ?? '',
        title:     r.title ?? query,
        salePrice: r.price,
        saleDate:  r.sale_date.slice(0, 10),
        platform:  r.platform ?? 'unknown',
        grader:    r.grader ?? null,
        grade:     r.grade ?? null,
      });
    }

    cursor = json.pagination?.next_cursor ?? null;
    page++;
  } while (cursor && page < maxPages);

  return allSales;
}

/**
 * Convenience wrapper that returns the same { date, price }[] shape
 * used by the chart components and card-history route.
 */
export async function getCardSoldHistory(
  query: string,
): Promise<Array<{ date: string; price: number }>> {
  const sales = await fetchCardSales(query, { limit: 200 });
  return sales
    .sort((a, b) => a.saleDate.localeCompare(b.saleDate))
    .map(s => ({ date: s.saleDate, price: s.salePrice }));
}
