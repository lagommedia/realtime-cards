import { EbayListing, CardPriceSummary, SetCardResult } from '@/types';

const EBAY_API_BASE = 'https://api.ebay.com';

// Module-level token cache — avoids a fresh OAuth call (1–2s) on every request.
// eBay client-credentials tokens last 2 hours; we refresh 5 min early.
let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getEbayToken(): Promise<string | null> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) return _tokenCache.token;

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${EBAY_API_BASE}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  // Cache for (expires_in - 5 min), default 2h - 5m
  const ttlMs = ((data.expires_in ?? 7200) - 300) * 1000;
  _tokenCache = { token: data.access_token, expiresAt: Date.now() + ttlMs };
  return data.access_token;
}

// Module-level result cache keyed by query string — makes repeat lookups instant.
// Entries expire after 5 minutes to keep prices fresh.
const _resultCache = new Map<string, { sets: SetCardResult[]; expiresAt: number }>();

async function searchEbayListings(
  query: string,
  token: string,
  sold = false,
  limit = 10,
): Promise<EbayListing[]> {
  const category = '212'; // Sports Trading Cards

  // Active listings: Buy It Now only. Sold listings use the Marketplace Insights API.
  const filterParam = sold ? '' : '&filter=buyingOptions:{FIXED_PRICE}';

  const endpoint = sold
    ? `/buy/marketplace_insights/v1_beta/item_sales/search?q=${encodeURIComponent(query)}&category_ids=${category}&limit=${limit}`
    : `/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&category_ids=${category}&limit=${limit}${filterParam}`;

  const res = await fetch(`${EBAY_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Content-Type': 'application/json',
    },
    next: { revalidate: 300 },
  }).catch(() => null);

  if (!res?.ok) return [];

  const data = await res.json() as {
    itemSummaries?: Array<{
      itemId: string;
      title: string;
      price?: { value: string; currency: string };
      condition?: string;
      image?: { imageUrl: string };
      thumbnailImages?: Array<{ imageUrl: string }>;
      itemWebUrl?: string;
    }>;
    itemSales?: Array<{
      itemId: string;
      title: string;
      lastSoldPrice?: { value: string; currency: string };
      lastSoldDate?: string;
      condition?: string;
      image?: { imageUrl: string };
      thumbnailImages?: Array<{ imageUrl: string }>;
      itemWebUrl?: string;
    }>;
  };

  if (sold && data.itemSales) {
    return data.itemSales.map(item => ({
      itemId: item.itemId,
      title: item.title,
      price: parseFloat(item.lastSoldPrice?.value ?? '0'),
      currency: item.lastSoldPrice?.currency ?? 'USD',
      condition: item.condition ?? 'Unknown',
      imageUrl: upgradeEbayImageUrl(item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl),
      itemUrl: item.itemWebUrl ?? '',
      soldDate: item.lastSoldDate,
    }));
  }

  return (data.itemSummaries ?? []).map(item => ({
    itemId: item.itemId,
    title: item.title,
    price: parseFloat(item.price?.value ?? '0'),
    currency: item.price?.currency ?? 'USD',
    condition: item.condition ?? 'Unknown',
    imageUrl: upgradeEbayImageUrl(item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl),
    itemUrl: item.itemWebUrl ?? '',
  }));
}

function generateMockPriceHistory(basePrice: number): { date: string; price: number }[] {
  const history = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const variance = (Math.random() - 0.5) * 0.2 * basePrice;
    history.push({
      date: date.toISOString().split('T')[0],
      price: Math.max(0.99, parseFloat((basePrice + variance).toFixed(2))),
    });
  }
  return history;
}

function generateMockListings(playerName: string): EbayListing[] {
  const basePrice = Math.random() * 40 + 5;
  return [
    {
      itemId: `mock-${Date.now()}-1`,
      title: `${playerName} 2024 Topps Series 1 Base Card RC`,
      price: parseFloat(basePrice.toFixed(2)),
      currency: 'USD',
      condition: 'Near Mint',
      itemUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(playerName + ' topps series 1 RC')}`,
    },
    {
      itemId: `mock-${Date.now()}-2`,
      title: `${playerName} 2024 Topps Chrome RC`,
      price: parseFloat((basePrice * 2.8).toFixed(2)),
      currency: 'USD',
      condition: 'Mint',
      itemUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(playerName + ' topps chrome RC')}`,
    },
  ];
}

function upgradeEbayImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/s-l\d+(\.\w+)$/, '/s-l500$1');
}

// ── Filtering helpers ─────────────────────────────────────────────────────────

const EXCLUDED_CARD_BRANDS = /\b(bowman|prizm|donruss|panini|select|optic|score|leaf|upper\s*deck|fleer|finest|heritage|stadium\s*club|gypsy(\s*queen)?|allen(\s*(and|&|n))?\s*ginter|archives|gallery|inception|clearly\s*authentic|luminance|mosaic|chronicles|national\s*treasure|immaculate|contenders?|playoff|triple\s*thread|topps\s*now|tier\s*one|five\s*star|dynasty|high\s*tek)\b/i;

const EXCLUDED_BRANDS = /\b(bowman|prizm|donruss|panini|select|optic|score|leaf|upper\s*deck|fleer|finest|heritage|stadium\s*club|gypsy(\s*queen)?|allen(\s*(and|&|n))?\s*ginter|archives|gallery|inception|clearly\s*authentic|luminance|mosaic|chronicles|national\s*treasure|immaculate|contenders?|playoff|triple\s*thread|topps\s*now|tier\s*one|five\s*star|dynasty|high\s*tek|psa|bgs|sgc|cgc|beckett|graded|slab)\b/i;

const TOPPS_ALLOWED_SETS = /\b(series\s*[12]|series\s*one|series\s*two|update(\s+series)?|chrome)\b/i;

function gradingPattern(company: string): RegExp {
  if (company === 'psa') return /\bpsa\b/i;
  if (company === 'bgs') return /\b(bgs|beckett)\b/i;
  if (company === 'sgc') return /\bsgc\b/i;
  return /(?!)/;
}

function isAllowedToppsRC(title: string): boolean {
  if (EXCLUDED_BRANDS.test(title)) return false;
  return TOPPS_ALLOWED_SETS.test(title);
}

// ── Per-set RC search (player profile swiper) ─────────────────────────────────

const RC_PATTERN = /\brc\b|\brookie\s*card\b/i;

// Exact title patterns for each Topps flagship set
const TOPPS_SET_DEFS = [
  { set: 'Topps Series 1', shortName: 'S1',     pattern: /\btopps\s+series\s*(?:1|one)\b/i },
  { set: 'Topps Series 2', shortName: 'S2',     pattern: /\btopps\s+series\s*(?:2|two)\b/i },
  { set: 'Topps Update',   shortName: 'Update', pattern: /\btopps\s+update\b/i },
  { set: 'Topps Chrome',   shortName: 'Chrome', pattern: /\btopps\s+chrome\b/i },
] as const;

function matchesGrading(title: string, company: string, grade?: string): boolean {
  const gPat = gradingPattern(company);
  if (!gPat.test(title)) return false;
  if (grade) {
    const gradePat = new RegExp(`\\b${grade.replace('.', '\\.')}\\b`);
    if (!gradePat.test(title)) return false;
  }
  return true;
}

// Topps flagship sets we recognize in listing titles
const TOPPS_SET_MAP: Array<{ pattern: RegExp; set: string; shortName: string }> = [
  { pattern: /\btopps\s+chrome\b/i,                            set: 'Topps Chrome',   shortName: 'Chrome' },
  { pattern: /\btopps\s+update\b/i,                            set: 'Topps Update',   shortName: 'Update' },
  { pattern: /\btopps\s+series\s*(?:2|two)\b|\btopps\s+s2\b/i, set: 'Topps Series 2', shortName: 'S2'     },
  { pattern: /\btopps\s+series\s*(?:1|one)\b|\btopps\s+s1\b/i, set: 'Topps Series 1', shortName: 'S1'     },
];

const NON_TOPPS_BRANDS = /\b(bowman|prizm|donruss|panini|select|optic|score|leaf|upper\s*deck|fleer|finest|heritage|stadium\s*club|gypsy|allen|archives|gallery|inception|luminance|mosaic|chronicles|national\s*treasure|immaculate|contenders?|playoff|triple\s*thread|topps\s*now|tier\s*one|five\s*star|dynasty|high\s*tek)\b/i;

/**
 * Single eBay BIN search for a player's Topps RC PSA listings.
 * Returns up to 10 active Buy-It-Now listings.
 */
export async function getPlayerCardSets(
  playerName: string,
  rookieYear: number,
  _gradingCompany?: string,  // reserved — PSA is always used
  gradeValue?: string,
): Promise<SetCardResult[]> {
  const grade = gradeValue ?? '10';
  const cacheKey = `${playerName}|${rookieYear}|psa|${grade}`;
  const cached = _resultCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.sets;

  const token = await getEbayToken();
  if (!token) return [];

  const yearStr = rookieYear > 0 ? ` ${rookieYear}` : '';
  const query   = `${playerName}${yearStr} Topps RC PSA ${grade}`;

  const listings = await searchEbayListings(query, token, false, 10);

  const results: SetCardResult[] = [];

  for (const listing of listings) {
    if (!listing.itemUrl) continue;

    const title = listing.title;

    // Must be a Topps RC with PSA — skip non-Topps brands and ungraded cards
    if (NON_TOPPS_BRANDS.test(title)) continue;
    if (!/\btopps\b/i.test(title)) continue;
    if (!/\brc\b|\brookie\b/i.test(title)) continue;
    if (!/\bpsa\b/i.test(title)) continue;

    // Identify which Topps set — fall back to generic "Topps" for base-set titles
    // that don't say "Series 1/2/Update/Chrome" explicitly (e.g. "2016 Topps #34 RC")
    const setInfo = TOPPS_SET_MAP.find(s => s.pattern.test(title))
      ?? { set: 'Topps', shortName: 'Topps' };

    results.push({
      set: setInfo.set,
      shortName: setInfo.shortName,
      year: rookieYear,
      binPrice: listing.price,
      soldPrice: null,
      soldDate:  undefined,
      imageUrl:  listing.imageUrl,
      itemUrl:   listing.itemUrl,
    });
  }

  _resultCache.set(cacheKey, { sets: results, expiresAt: Date.now() + 5 * 60 * 1000 });
  return results;
}

// ── Card image search (BaseballCardImage component) ───────────────────────────

export async function searchCardImage(
  playerName: string,
  cardYear: string,
  cardSet: string,
  gradingCompany?: string,
  gradeValue?: string,
): Promise<string | null> {
  const token = await getEbayToken();
  if (!token) return null;

  const companyLabel = gradingCompany?.toUpperCase() ?? '';
  const gradeLabel = gradingCompany && gradeValue ? ` ${gradeValue}` : '';
  const query = gradingCompany
    ? `${playerName} ${cardYear} ${companyLabel}${gradeLabel} ${cardSet} rookie card RC`
    : `${playerName} ${cardYear} ${cardSet} rookie card RC`;
  const listings = await searchEbayListings(query, token, false);

  let raw: EbayListing[];

  if (gradingCompany) {
    const gPat = gradingPattern(gradingCompany);
    const gradePat = gradeValue ? new RegExp(`\\b${gradeValue.replace('.', '\\.')}\\b`) : null;
    raw = listings.filter(l => l.imageUrl && gPat.test(l.title)
      && (!gradePat || gradePat.test(l.title))
      && !EXCLUDED_CARD_BRANDS.test(l.title));
    if (raw.length === 0 && gradePat)
      raw = listings.filter(l => l.imageUrl && gPat.test(l.title) && gradePat.test(l.title));
    if (raw.length === 0) raw = listings.filter(l => l.imageUrl && gPat.test(l.title));
  } else {
    raw = listings.filter(l => l.imageUrl && isAllowedToppsRC(l.title));
    if (raw.length === 0)
      raw = listings.filter(l => l.imageUrl && /\btopps\b/i.test(l.title) && !EXCLUDED_BRANDS.test(l.title));
    if (raw.length === 0) raw = listings.filter(l => l.imageUrl);
  }

  // Fallback: fetch full item detail for the best candidate (search summary often omits images)
  if (raw.length === 0 && listings.length > 0) {
    const bestId = listings.find(l => isAllowedToppsRC(l.title))?.itemId
      ?? listings.find(l => /\btopps\b/i.test(l.title) && !EXCLUDED_BRANDS.test(l.title))?.itemId
      ?? listings[0]?.itemId;
    if (bestId) {
      try {
        const detailRes = await fetch(`${EBAY_API_BASE}/buy/browse/v1/item/${bestId}`, {
          headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
          next: { revalidate: 3600 },
        });
        if (detailRes.ok) {
          const detail = await detailRes.json() as {
            image?: { imageUrl: string };
            additionalImages?: Array<{ imageUrl: string }>;
          };
          const url = detail.image?.imageUrl ?? detail.additionalImages?.[0]?.imageUrl;
          if (url) return url;
        }
      } catch { /* fall through */ }
    }
  }

  const playerTokens = playerName.toLowerCase().split(/\s+/);
  const setTokens = cardSet.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  function titleScore(title: string): number {
    const t = title.toLowerCase();
    let s = 0;
    for (const tok of playerTokens) if (t.includes(tok)) s += 2;
    if (cardYear && t.includes(cardYear)) s += 3;
    for (const tok of setTokens) if (t.includes(tok)) s += 2;
    if (/\brc\b|rookie/i.test(title)) s += 1;
    return s;
  }

  const sorted = raw
    .map(l => ({ l, s: titleScore(l.title), isEbay: !!l.imageUrl?.includes('ebayimg.com') }))
    .sort((a, b) => {
      if (a.isEbay !== b.isEbay) return a.isEbay ? -1 : 1;
      return b.s - a.s;
    });

  return sorted[0]?.l.imageUrl ?? null;
}

// ── Pricing summary (TrendingPlayerCard / game feed) ─────────────────────────

export async function getPlayerCardPricing(
  playerId: number,
  playerName: string,
  rookieYear?: number,
  gradingCompany?: string,
  gradeValue?: string,
): Promise<CardPriceSummary> {
  const token = await getEbayToken();

  let recentSales: EbayListing[] = [];
  let activeListing: EbayListing | undefined;

  if (token) {
    const companyLabel = gradingCompany?.toUpperCase() ?? '';
    const gradeLabel   = gradingCompany && gradeValue ? ` ${gradeValue}` : '';
    const gradingStr   = gradingCompany ? ` ${companyLabel}${gradeLabel}` : '';
    const yearStr      = rookieYear ? ` ${rookieYear}` : '';
    const query        = `${playerName}${yearStr} Topps${gradingStr} RC`;

    const [sold, active] = await Promise.all([
      searchEbayListings(query, token, true),
      searchEbayListings(query, token, false),
    ]);
    recentSales = sold;

    if (gradingCompany) {
      const gPat = gradingPattern(gradingCompany);
      const gradePat = gradeValue ? new RegExp(`\\b${gradeValue.replace('.', '\\.')}\\b`) : null;
      activeListing =
        active.find(l => l.imageUrl && gPat.test(l.title) && (!gradePat || gradePat.test(l.title)) && !EXCLUDED_CARD_BRANDS.test(l.title)) ??
        active.find(l => gPat.test(l.title) && (!gradePat || gradePat.test(l.title)) && !EXCLUDED_CARD_BRANDS.test(l.title)) ??
        active.find(l => l.imageUrl && gPat.test(l.title)) ??
        active.find(l => gPat.test(l.title));
    } else {
      activeListing =
        active.find(l => l.imageUrl && isAllowedToppsRC(l.title)) ??
        active.find(l => l.imageUrl && /\btopps\b/i.test(l.title) && !EXCLUDED_BRANDS.test(l.title)) ??
        active.find(l => l.imageUrl) ??
        active[0];
    }

    // Fetch full item detail if the chosen listing has no image
    if (activeListing && !activeListing.imageUrl) {
      try {
        const detailRes = await fetch(`${EBAY_API_BASE}/buy/browse/v1/item/${activeListing.itemId}`, {
          headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
          next: { revalidate: 3600 },
        });
        if (detailRes.ok) {
          const detail = await detailRes.json() as { image?: { imageUrl: string } };
          if (detail.image?.imageUrl) {
            activeListing = { ...activeListing, imageUrl: detail.image.imageUrl };
          }
        }
      } catch { /* leave imageUrl undefined */ }
    }
  } else {
    recentSales   = generateMockListings(playerName).slice(0, 2);
    activeListing = generateMockListings(playerName)[0];
  }

  const allPrices = [...recentSales.map(s => s.price), activeListing?.price ?? 0].filter(p => p > 0);
  const avgPrice  = allPrices.length > 0 ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : 9.99;
  const basePrice = avgPrice || 9.99;

  return {
    playerId,
    playerName,
    averagePrice:  parseFloat(avgPrice.toFixed(2)),
    lowestPrice:   parseFloat(Math.min(...allPrices, basePrice).toFixed(2)),
    highestPrice:  parseFloat(Math.max(...allPrices, basePrice).toFixed(2)),
    recentSales,
    activeListing,
    priceHistory:  generateMockPriceHistory(basePrice),
  };
}
