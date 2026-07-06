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

const UA_MAC  = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const UA_WIN  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CACHE = { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } };

function scoreCardUrl(title: string, url: string, year: string, set: string): number {
  const c = (title + ' ' + url).toLowerCase();
  const setTokens = set.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  let s = 0;
  if (/ebayimg\.com/i.test(url))                  s += 14; // real listing photo
  else if (/tcdb\.com/i.test(url))                s += 12;
  else if (/comc\.com/i.test(url))               s += 10;
  else if (/psacard\.com|psa\.com/i.test(url))   s += 8;
  else if (/beckett\.com/i.test(url))            s += 7;
  else if (/sportscards|cardboard/i.test(url))   s += 5;
  else if (/ebay\.com/i.test(url))               s += 3;
  if (year && c.includes(year))                  s += 5;
  for (const t of setTokens) if (c.includes(t)) s += 2;
  if (/\brc\b|rookie/i.test(title))              s += 2;
  return s;
}

async function fetchFromBing(player: string, year: string, set: string): Promise<string | null> {
  try {
    const query = year && set
      ? `${player} ${year} ${set} rookie card RC baseball`
      : `${player} topps rookie card baseball RC`;

    const res = await fetch(
      `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&count=20&imgtype=photo`,
      {
        headers: {
          'User-Agent': UA_WIN,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) return null;

    const html = await res.text();
    // Bing embeds source image URLs as "murl":"<url>" in the page HTML
    const murls = [...html.matchAll(/"murl":"([^"]+)"/g)].map(m => m[1]);
    if (murls.length === 0) return null;

    const scored = murls
      .map(u => ({ u, s: scoreCardUrl('', u, year, set) }))
      .sort((a, b) => b.s - a.s);

    return scored[0]?.u ?? null;
  } catch {
    return null;
  }
}

async function fetchFromDDG(player: string, year: string, set: string): Promise<string | null> {
  try {
    const query = year && set
      ? `${player} ${year} "${set}" rookie card RC`
      : `${player} topps rookie card baseball RC`;

    const initRes = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
      {
        headers: { 'User-Agent': UA_MAC, Accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!initRes.ok) return null;

    const vqdMatch = (await initRes.text()).match(/vqd=['"]([^'"]+)['"]/);
    if (!vqdMatch) return null;

    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqdMatch[1])}&type=photo&o=json&s=0&p=1`,
      {
        headers: { 'User-Agent': UA_MAC, Referer: 'https://duckduckgo.com/', Accept: 'application/json, text/javascript' },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!imgRes.ok) return null;

    const data = await imgRes.json() as {
      results?: Array<{ image: string; title: string; url: string }>;
    };

    const best = (data.results ?? [])
      .filter(r => r.image)
      .slice(0, 15)
      .map(r => ({ r, s: scoreCardUrl(r.title, r.url, year, set) }))
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

  // Strategy 2: DuckDuckGo (works on residential IPs; may be blocked on Vercel datacenters)
  if (!imageUrl) {
    imageUrl = await fetchFromDDG(player, cardYear, cardSet);
  }

  // Strategy 3: Bing Images (more permissive with server IPs — primary production fallback)
  if (!imageUrl) {
    imageUrl = await fetchFromBing(player, cardYear, cardSet);
  }

  return NextResponse.json({ imageUrl }, CACHE);
}
