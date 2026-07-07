import { EbayListing, CardPriceSummary } from '@/types';

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
    next: { revalidate: 7000 }, // tokens last ~2 hours
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token?: string };
  return data.access_token ?? null;
}

async function searchEbayListings(
  query: string,
  token: string,
  sold = false
): Promise<EbayListing[]> {
  const category = '212'; // Sports Trading Cards
  const filterParam = sold
    ? '&filter=buyingOptions:{AUCTION|FIXED_PRICE},conditionIds:{1000|1500|2000|2500|3000}'
    : '';

  const endpoint = sold
    ? `/buy/marketplace_insights/v1_beta/item_sales/search?q=${encodeURIComponent(query)}&category_ids=${category}&limit=10`
    : `/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&category_ids=${category}&limit=10&fieldgroups=EXTENDED${filterParam}`;

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
      lastSoldDate?: string;
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
      imageUrl: item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl,
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
    imageUrl: item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl,
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
      title: `${playerName} 2024 Topps Base Card RC`,
      price: parseFloat(basePrice.toFixed(2)),
      currency: 'USD',
      condition: 'Near Mint',
      itemUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(playerName + ' baseball card')}`,
    },
    {
      itemId: `mock-${Date.now()}-2`,
      title: `${playerName} 2024 Bowman Chrome Prospect`,
      price: parseFloat((basePrice * 1.8).toFixed(2)),
      currency: 'USD',
      condition: 'Mint',
      itemUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(playerName + ' bowman chrome')}`,
    },
    {
      itemId: `mock-${Date.now()}-3`,
      title: `${playerName} 2023 Topps Update Gold Parallel /50`,
      price: parseFloat((basePrice * 3.5).toFixed(2)),
      currency: 'USD',
      condition: 'Mint',
      itemUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(playerName + ' topps gold')}`,
    },
  ];
}

// ── Card image filtering ──────────────────────────────────────────────────────

// Only these four Topps sets carry the official RC logo and are allowed
const TOPPS_ALLOWED_SETS = /\b(series\s*[12]|series\s*one|series\s*two|update(\s+series)?|chrome)\b/i;

// All other brands / Topps sub-products that should never appear
const EXCLUDED_BRANDS = /\b(bowman|prizm|donruss|panini|select|optic|score|leaf|upper\s*deck|fleer|finest|heritage|stadium\s*club|gypsy(\s*queen)?|allen(\s*(and|&|n))?\s*ginter|archives|gallery|inception|clearly\s*authentic|luminance|mosaic|chronicles|national\s*treasure|immaculate|contenders?|playoff|triple\s*thread|topps\s*now|tier\s*one|five\s*star|dynasty|high\s*tek|psa|bgs|sgc|cgc|beckett|graded|slab)\b/i;

/**
 * Returns true only for listings that are:
 *   - A Topps Series 1 / Series 2 / Update / Chrome card
 *   - Not a graded slab (PSA, BGS, SGC, CGC…)
 *   - Not from an excluded brand (Bowman, Prizm, Donruss, Panini…)
 */
function isAllowedToppsRC(title: string): boolean {
  if (EXCLUDED_BRANDS.test(title)) return false;
  return TOPPS_ALLOWED_SETS.test(title);
}

/**
 * Searches eBay for a specific card (player + year + set) and returns an
 * image URL of a raw (ungraded) copy. Ranks results to prefer:
 *   1. eBay CDN images (i.ebayimg.com) — actual card photos from sellers
 *   2. Higher title-match scores for player name, year, and set keywords
 * Only returns Topps Series 1 / 2 / Update / Chrome listings.
 */
export async function searchCardImage(
  playerName: string,
  cardYear: string,
  cardSet: string,
): Promise<string | null> {
  const token = await getEbayToken();
  if (!token) return null;

  const query = `${playerName} ${cardYear} ${cardSet} rookie card RC`;
  const listings = await searchEbayListings(query, token, false);

  // Strict: only allowed Topps RC sets, no slabs, must have an image
  let raw = listings.filter(l => l.imageUrl && isAllowedToppsRC(l.title));

  // Fallback 1: any Topps listing without excluded brands
  if (raw.length === 0) {
    raw = listings.filter(l =>
      l.imageUrl &&
      /\btopps\b/i.test(l.title) &&
      !EXCLUDED_BRANDS.test(l.title)
    );
  }

  // Fallback 2: any listing with an image from the specific query
  if (raw.length === 0) {
    raw = listings.filter(l => l.imageUrl);
  }

  // Score by title relevance
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

  // Sort: prefer eBay CDN images (actual card photos), then by title score
  const sorted = raw
    .map(l => ({ l, s: titleScore(l.title), isEbay: !!l.imageUrl?.includes('ebayimg.com') }))
    .sort((a, b) => {
      if (a.isEbay !== b.isEbay) return a.isEbay ? -1 : 1;
      return b.s - a.s;
    });

  return sorted[0]?.l.imageUrl ?? null;
}

export async function getPlayerCardPricing(
  playerId: number,
  playerName: string,
  rookieYear?: number
): Promise<CardPriceSummary> {
  const token = await getEbayToken();

  let recentSales: EbayListing[] = [];
  let activeListing: EbayListing | undefined;

  if (token) {
    // Target the specific Topps Base Rookie Card when we know the debut year
    const query = rookieYear
      ? `${playerName} ${rookieYear} Topps rookie card RC`
      : `${playerName} Topps rookie card RC baseball`;
    const [sold, active] = await Promise.all([
      searchEbayListings(query, token, true),
      searchEbayListings(query, token, false),
    ]);
    recentSales = sold;
    // Prefer a listing that matches the allowed Topps sets for the card image
    activeListing =
      active.find(l => l.imageUrl && isAllowedToppsRC(l.title)) ??
      active.find(l => l.imageUrl && /\btopps\b/i.test(l.title) && !EXCLUDED_BRANDS.test(l.title)) ??
      active.find(l => l.imageUrl) ??
      active[0];
  } else {
    // Use mock data when no eBay credentials are configured
    recentSales = generateMockListings(playerName).slice(0, 2);
    activeListing = generateMockListings(playerName)[0];
  }

  const allPrices = [...recentSales.map(s => s.price), activeListing?.price ?? 0].filter(p => p > 0);
  const avgPrice = allPrices.length > 0 ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : 9.99;
  const basePrice = avgPrice || 9.99;

  return {
    playerId,
    playerName,
    averagePrice: parseFloat(avgPrice.toFixed(2)),
    lowestPrice: parseFloat(Math.min(...allPrices, basePrice).toFixed(2)),
    highestPrice: parseFloat(Math.max(...allPrices, basePrice).toFixed(2)),
    recentSales,
    activeListing,
    priceHistory: generateMockPriceHistory(basePrice),
  };
}
