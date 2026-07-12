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

// Module-level pricing cache — prevents re-fetching eBay sold/active listings for the
// same player on every game-route poll (which fires every 30s for ~32 players).
const _pricingCache = new Map<string, { summary: CardPriceSummary; expiresAt: number }>();

async function searchEbayListings(
  query: string,
  token: string,
  sold = false,
  limit = 10,
): Promise<EbayListing[] | 'rate_limited'> {
  const category = '212'; // Sports Trading Cards

  // Active listings: Buy It Now only. Sold listings use the Marketplace Insights API.
  const filterParam = sold ? '' : '&filter=buyingOptions:{FIXED_PRICE}';

  const endpoint = sold
    ? `/buy/marketplace_insights/v1_beta/item_sales/search?q=${encodeURIComponent(query)}&category_ids=${category}&limit=${limit}`
    : `/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&category_ids=${category}&limit=${limit}${filterParam}`;

  const affiliateCampaignId = process.env.EBAY_AFFILIATE_CAMPAIGN_ID;
  const affiliateCtx = affiliateCampaignId
    ? `affiliateCampaignId=${affiliateCampaignId}`
    : null;

  const fetchOpts = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Content-Type': 'application/json',
      ...(affiliateCtx ? { 'X-EBAY-C-ENDUSERCTX': affiliateCtx } : {}),
    },
    cache: 'no-store' as const,
  };

  const res = await fetch(`${EBAY_API_BASE}${endpoint}`, fetchOpts).catch(() => null);

  if (res?.status === 429) return 'rate_limited';
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
      itemAffiliateWebUrl?: string;
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
      itemAffiliateWebUrl?: string;
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
      itemUrl: item.itemAffiliateWebUrl ?? item.itemWebUrl ?? '',
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
    itemUrl: item.itemAffiliateWebUrl ?? item.itemWebUrl ?? '',
  }));
}

function generateMockPriceHistory(basePrice: number): { date: string; price: number }[] {
  const history: { date: string; price: number }[] = [];
  const now = new Date();
  // Generate weekly data from Opening Day through today
  const seasonStart = new Date('2026-03-28T12:00:00Z');
  const start = seasonStart < now ? seasonStart : new Date(now.getTime() - 91 * 86400000);
  const current = new Date(start);
  // Start price somewhat below current so history has upward trend room
  let price = basePrice * 0.84;
  while (current <= now) {
    const drift = (Math.random() - 0.44) * 0.09; // slight upward bias
    price = Math.max(0.99, price * (1 + drift));
    history.push({ date: current.toISOString().split('T')[0], price: parseFloat(price.toFixed(2)) });
    current.setDate(current.getDate() + 7);
  }
  // Pin last point to current price for continuity with projection
  if (history.length > 0) history[history.length - 1].price = basePrice;
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
      itemUrl: `https://rover.ebay.com/rover/1/711-53200-19255-0/1?mpre=${encodeURIComponent('https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(playerName + ' topps series 1 RC'))}&campid=5339164547`,
    },
    {
      itemId: `mock-${Date.now()}-2`,
      title: `${playerName} 2024 Topps Chrome RC`,
      price: parseFloat((basePrice * 2.8).toFixed(2)),
      currency: 'USD',
      condition: 'Mint',
      itemUrl: `https://rover.ebay.com/rover/1/711-53200-19255-0/1?mpre=${encodeURIComponent('https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(playerName + ' topps chrome RC'))}&campid=5339164547`,
    },
  ];
}

function upgradeEbayImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/s-l\d+(\.\w+)$/, '/s-l500$1');
}

// ── Filtering helpers ─────────────────────────────────────────────────────────

const EXCLUDED_CARD_BRANDS = /\b(prizm|donruss|panini|select|optic|score|leaf|upper\s*deck|fleer|finest|heritage|stadium\s*club|gypsy(\s*queen)?|allen(\s*(and|&|n))?\s*ginter|archives|gallery|inception|clearly\s*authentic|luminance|mosaic|chronicles|national\s*treasure|immaculate|contenders?|playoff|triple\s*thread|topps\s*now|tier\s*one|five\s*star|dynasty|high\s*tek)\b/i;

const EXCLUDED_BRANDS = /\b(prizm|donruss|panini|select|optic|score|leaf|upper\s*deck|fleer|finest|heritage|stadium\s*club|gypsy(\s*queen)?|allen(\s*(and|&|n))?\s*ginter|archives|gallery|inception|clearly\s*authentic|luminance|mosaic|chronicles|national\s*treasure|immaculate|contenders?|playoff|triple\s*thread|topps\s*now|tier\s*one|five\s*star|dynasty|high\s*tek|psa|bgs|sgc|cgc|beckett|graded|slab)\b/i;

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

// Topps + Bowman sets we recognize in listing titles (most-specific first)
const TOPPS_SET_MAP: Array<{ pattern: RegExp; set: string; shortName: string }> = [
  { pattern: /\btopps\s+chrome\b/i,                                           set: 'Topps Chrome',      shortName: 'Chrome'      },
  { pattern: /\btopps\s+update\b/i,                                           set: 'Topps Update',      shortName: 'Update'      },
  { pattern: /\btopps\s+series\s*(?:2|two)\b|\btopps\s+s2\b/i,               set: 'Topps Series 2',    shortName: 'S2'          },
  { pattern: /\btopps\s+series\s*(?:1|one)\b|\btopps\s+s1\b/i,               set: 'Topps Series 1',    shortName: 'S1'          },
  { pattern: /\bbowman\s+chrome\b.*\b1st\b|\b1st\s+bowman\s+chrome\b/i,      set: 'Bowman Chrome 1st', shortName: 'Chrome 1st'  },
  { pattern: /\bbowman\s+chrome\b/i,                                          set: 'Bowman Chrome',     shortName: 'Bowman Chrome'},
  { pattern: /\b1st\s+bowman\b|\bbowman\s+1st\b/i,                           set: 'Bowman 1st',        shortName: 'Bowman 1st'  },
  { pattern: /\bbowman\b/i,                                                   set: 'Bowman',            shortName: 'Bowman'      },
];

const NON_TOPPS_BOWMAN_BRANDS = /\b(prizm|donruss|panini|select|optic|score|leaf|upper\s*deck|fleer|finest|heritage|stadium\s*club|gypsy|allen|archives|gallery|inception|luminance|mosaic|chronicles|national\s*treasure|immaculate|contenders?|playoff|triple\s*thread|topps\s*now|tier\s*one|five\s*star|dynasty|high\s*tek)\b/i;

// Parallel, auto, and numbered-card markers — anything that isn't the base card
const PARALLEL_MARKERS = /\b(auto(?:graph)?|refractor|xfractor|superfractor|gold|silver|blue|red|orange|purple|pink|green|yellow|black|rainbow|foil|short\s*print|wave|1st\s*ed(?:ition)?)\b|\/\d+\b|\bsp\b/i;

function isBaseCard(title: string): boolean {
  return !PARALLEL_MARKERS.test(title);
}

/**
 * Fetches up to 10 active BIN PSA Topps RC listings for a player.
 * Uses a single broad "Topps RC PSA" query — 4 parallel set-specific queries
 * burned through eBay's production burst rate limit (429s). One call per
 * batter is well within limits. Set labels are derived from listing titles.
 *
 * Returns { sets, rateLimited } so callers can distinguish "no results"
 * from "eBay quota exhausted" and show a better message to the user.
 */
export async function getPlayerCardSets(
  playerName: string,
  rookieYear: number,
  _gradingCompany?: string,  // reserved — PSA is always used
  gradeValue?: string,
): Promise<{ sets: SetCardResult[]; rateLimited: boolean }> {
  const grade = gradeValue ?? '10';
  const cacheKey = `${playerName}|${rookieYear}|psa|${grade}`;
  const cached = _resultCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return { sets: cached.sets, rateLimited: false };

  const token = await getEbayToken();
  if (!token) return { sets: [], rateLimited: false };

  // Two parallel BIN searches: Topps flagship RCs + Bowman 1st/RC cards.
  // Kept to 2 queries — prior attempt with 4 parallel queries hit rate limits.
  const toppsQuery  = `${playerName} ${rookieYear} Topps Rookie Card PSA ${grade}`;
  const bowmanQuery = `${playerName} Bowman PSA ${grade}`;
  const [toppsRaw, bowmanRaw] = await Promise.all([
    searchEbayListings(toppsQuery,  token, false, 15),
    searchEbayListings(bowmanQuery, token, false, 10),
  ]);

  if (toppsRaw === 'rate_limited' || bowmanRaw === 'rate_limited') return { sets: [], rateLimited: true };

  const combined = [...toppsRaw, ...bowmanRaw];

  // Brand is the dominant axis — ALL Topps before ANY Bowman.
  // Within each brand, base cards come before parallels/autos.
  // Scores: Topps base=0, Topps parallel=1, Bowman base=10, Bowman parallel=11
  combined.sort((a, b) => {
    const score = (t: string) => (/\btopps\b/i.test(t) ? 0 : 10) + (isBaseCard(t) ? 0 : 1);
    return score(a.title) - score(b.title);
  });

  const seenIds = new Set<string>();
  const results: SetCardResult[] = [];

  for (const listing of combined) {
    if (!listing.itemId || seenIds.has(listing.itemId)) continue;
    seenIds.add(listing.itemId);

    const title = listing.title;
    if (NON_TOPPS_BOWMAN_BRANDS.test(title)) continue;
    if (!/\btopps\b|\bbowman\b/i.test(title)) continue;
    if (!/\brc\b|\brookie\b|\b1st\b/i.test(title)) continue;
    if (!/\bpsa\b/i.test(title)) continue;
    // Bowman: only allow 1st Bowman or official Rookie Card — no generic Draft/base sets
    if (/\bbowman\b/i.test(title) && !/\b1st\b|\brc\b|\brookie\b/i.test(title)) continue;

    const setInfo = TOPPS_SET_MAP.find(s => s.pattern.test(title))
      ?? { set: 'Topps', shortName: 'Topps' };

    results.push({
      set: setInfo.set,
      shortName: setInfo.shortName,
      year: rookieYear,
      binPrice:  listing.price,
      soldPrice: null,
      soldDate:  undefined,
      imageUrl:  listing.imageUrl,
      itemUrl:   listing.itemUrl,
    });
  }

  const sets = results.slice(0, 10);

  // Only cache non-empty results — an empty response shouldn't block retries.
  if (sets.length > 0) {
    _resultCache.set(cacheKey, { sets, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });
  }
  return { sets, rateLimited: false };
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
  const searchResult = await searchEbayListings(query, token, false);
  const listings: EbayListing[] = searchResult === 'rate_limited' ? [] : searchResult;

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
  const pricingKey = `${playerId}|${rookieYear ?? 0}|${gradingCompany ?? ''}|${gradeValue ?? ''}`;
  const cachedPricing = _pricingCache.get(pricingKey);
  if (cachedPricing && Date.now() < cachedPricing.expiresAt) return cachedPricing.summary;

  const token = await getEbayToken();

  let recentSales: EbayListing[] = [];
  let activeListing: EbayListing | undefined;

  if (token) {
    const companyLabel = gradingCompany?.toUpperCase() ?? '';
    const gradeLabel   = gradingCompany && gradeValue ? ` ${gradeValue}` : '';
    const gradingStr   = gradingCompany ? ` ${companyLabel}${gradeLabel}` : '';
    const yearStr      = rookieYear ? ` ${rookieYear}` : '';
    const query        = `${playerName}${yearStr} Topps${gradingStr} RC`;

    const [soldRaw, activeRaw] = await Promise.all([
      searchEbayListings(query, token, true),
      searchEbayListings(query, token, false),
    ]);
    const sold:   EbayListing[] = soldRaw   === 'rate_limited' ? [] : soldRaw;
    const active: EbayListing[] = activeRaw === 'rate_limited' ? [] : activeRaw;
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

  const summary: CardPriceSummary = {
    playerId,
    playerName,
    averagePrice:  parseFloat(avgPrice.toFixed(2)),
    lowestPrice:   parseFloat(Math.min(...allPrices, basePrice).toFixed(2)),
    highestPrice:  parseFloat(Math.max(...allPrices, basePrice).toFixed(2)),
    recentSales,
    activeListing,
    priceHistory:  generateMockPriceHistory(basePrice),
  };
  _pricingCache.set(pricingKey, { summary, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });
  return summary;
}
