import { EbayListing, CardPriceSummary, SetCardResult } from '@/types';

const EBAY_API_BASE = 'https://api.ebay.com';

async function getEbayToken(): Promise<string | null> {
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
    next: { revalidate: 7000 },
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token?: string };
  return data.access_token ?? null;
}

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
  });

  if (!res.ok) return [];

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

/**
 * Queries eBay for each of the four Topps flagship RC sets and returns only
 * those where a real listing (exact title match) exists. Sold prices come from
 * the Marketplace Insights API; card images and click-through URLs come from
 * Buy It Now active listings only.
 */
export async function getPlayerCardSets(
  playerName: string,
  rookieYear: number,
  gradingCompany?: string,
  gradeValue?: string,
): Promise<SetCardResult[]> {
  const token = await getEbayToken();
  if (!token) return [];

  const companyLabel = gradingCompany?.toUpperCase() ?? '';
  const gradeLabel   = gradingCompany && gradeValue ? ` ${gradeValue}` : '';
  const gradingStr   = gradingCompany ? ` ${companyLabel}${gradeLabel}` : '';
  const yearStr      = rookieYear > 0 ? ` ${rookieYear}` : '';

  // Two broad searches cover S1/S2/Update; one Chrome-specific search for precision.
  // 4 total calls run in parallel — sold prices from Insights, images from BIN Browse.
  const broadQuery  = `${playerName}${yearStr} Topps${gradingStr} RC`;
  const chromeQuery = `${playerName}${yearStr} Topps Chrome${gradingStr} RC`;

  const [broadSold, broadBIN, chromeSold, chromeBIN] = await Promise.all([
    searchEbayListings(broadQuery,  token, true,  20),
    searchEbayListings(broadQuery,  token, false, 50), // more BIN listings to swipe through
    searchEbayListings(chromeQuery, token, true,  10),
    searchEbayListings(chromeQuery, token, false, 25),
  ]);

  const results: SetCardResult[] = [];

  for (const { set, shortName, pattern } of TOPPS_SET_DEFS) {
    const isChrome  = set === 'Topps Chrome';
    const soldPool  = isChrome ? chromeSold : broadSold;
    const binPool   = isChrome ? chromeBIN  : broadBIN;

    const isExact = (title: string) => pattern.test(title) && RC_PATTERN.test(title);
    const isGradingMatch = (title: string) =>
      gradingCompany ? matchesGrading(title, gradingCompany, gradeValue) : true;

    // One sold-price reference for the whole set
    const soldMatch = soldPool.find(l => isExact(l.title) && isGradingMatch(l.title));
    // ALL matching BIN listings — each becomes a swipeable card
    const binMatches = binPool.filter(l => isExact(l.title) && isGradingMatch(l.title) && !!l.itemUrl);

    if (binMatches.length === 0 && !soldMatch) continue;

    if (binMatches.length === 0) {
      // No BIN available but we have a sold reference — show one placeholder card
      results.push({
        set, shortName, year: rookieYear,
        binPrice:  null,
        soldPrice: soldMatch!.price,
        soldDate:  soldMatch!.soldDate,
        imageUrl:  soldMatch!.imageUrl,
        itemUrl:   soldMatch!.itemUrl ?? '',
      });
    } else {
      // One card per BIN listing; all share the same sold-price reference
      for (const bin of binMatches) {
        results.push({
          set, shortName, year: rookieYear,
          binPrice:  bin.price,
          soldPrice: soldMatch?.price ?? null,
          soldDate:  soldMatch?.soldDate,
          imageUrl:  bin.imageUrl,
          itemUrl:   bin.itemUrl,
        });
      }
    }
  }

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
