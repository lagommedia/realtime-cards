import { NextRequest, NextResponse } from 'next/server';
import { searchCardImage } from '@/lib/ebay-api';

/**
 * Returns the best available image for a specific baseball card.
 *
 * Strategy (runs in priority order, first result wins):
 *   1. eBay API — targeted search for the exact player + year + set,
 *      filtered to raw (ungraded) listings, ranked to prefer actual
 *      card photos (ebayimg.com CDN) over third-party stock images.
 *   2. DuckDuckGo images — broad fallback with score-ranked results
 *      (TCDB and COMC are Cloudflare-protected so they can't be scraped).
 *
 * GET /api/card-image?player=Shohei+Ohtani&year=2018&set=Topps+Series+1
 */

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CACHE = { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } };

async function fetchFromDDG(player: string, year: string, set: string): Promise<string | null> {
  try {
    const query = year && set
      ? `${player} ${year} "${set}" rookie card RC`
      : `${player} topps rookie card baseball RC`;

    const initRes = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
      { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' } }
    );
    if (!initRes.ok) return null;

    const vqdMatch = (await initRes.text()).match(/vqd=['"]([^'"]+)['"]/);
    if (!vqdMatch) return null;

    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqdMatch[1])}&type=photo&o=json&s=0&p=1`,
      { headers: { 'User-Agent': UA, Referer: 'https://duckduckgo.com/', Accept: 'application/json, text/javascript' } }
    );
    if (!imgRes.ok) return null;

    const data = await imgRes.json() as {
      results?: Array<{ image: string; title: string; url: string }>;
    };

    const setTokens = set.toLowerCase().split(/\s+/).filter(t => t.length > 2);

    function score(r: { title: string; url: string }): number {
      const c = (r.title + ' ' + r.url).toLowerCase();
      let s = 0;
      if (/tcdb\.com/i.test(r.url))                   s += 12;
      else if (/comc\.com/i.test(r.url))              s += 10;
      else if (/psacard\.com|psa\.com/i.test(r.url))  s += 8;
      else if (/beckett\.com/i.test(r.url))           s += 7;
      else if (/sportscards|cardboard/i.test(r.url))  s += 5;
      else if (/ebay\.com/i.test(r.url))              s += 3;
      if (year && c.includes(year)) s += 5;
      for (const t of setTokens) if (c.includes(t)) s += 2;
      if (/\brc\b|rookie/i.test(r.title)) s += 2;
      return s;
    }

    const best = (data.results ?? [])
      .filter(r => r.image)
      .slice(0, 15)
      .map(r => ({ r, s: score(r) }))
      .sort((a, b) => b.s - a.s)[0]?.r ?? null;

    return best?.image ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const player   = request.nextUrl.searchParams.get('player') ?? '';
  const cardYear = request.nextUrl.searchParams.get('year')   ?? '';
  const cardSet  = request.nextUrl.searchParams.get('set')    ?? '';

  if (!player) return NextResponse.json({ imageUrl: null });

  // Strategy 1: eBay API with set-specific query (most reliable when credentials exist)
  let imageUrl: string | null = null;
  if (cardYear && cardSet) {
    imageUrl = await searchCardImage(player, cardYear, cardSet);
  }

  // Strategy 2: DuckDuckGo fallback
  if (!imageUrl) {
    imageUrl = await fetchFromDDG(player, cardYear, cardSet);
  }

  return NextResponse.json({ imageUrl }, CACHE);
}
