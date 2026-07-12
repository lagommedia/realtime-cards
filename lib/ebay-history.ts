/**
 * Fetches historical eBay sold listings for a player's cards and buckets
 * them by week so the AI pipeline can correlate price movements with
 * milestone events from the MLB game-log data.
 */

import { MilestoneEvent } from './mlb-stats-history';

const EBAY_API_BASE = 'https://api.ebay.com';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeeklyPriceBucket {
  weekOf: string;       // ISO date of Monday starting that week
  avgSoldPrice: number;
  minPrice: number;
  maxPrice: number;
  sampleSize: number;
}

export interface SetPriceHistory {
  set: string;
  year: number;
  weeklyBuckets: WeeklyPriceBucket[];
  rawListingCount: number;
}

export interface MilestoneImpact {
  milestone: MilestoneEvent;
  baseline30dAvg: number | null;   // avg sold price in 30 days before event
  post7dAvg:  number | null;
  post14dAvg: number | null;
  post30dAvg: number | null;
  pctChange7d:  number | null;     // null if not enough data
  pctChange30d: number | null;
}

export interface PlayerCardHistory {
  playerName: string;
  sets: SetPriceHistory[];
  milestoneImpacts: MilestoneImpact[];  // milestone × price correlation
}

// ── eBay token (re-use the pattern from ebay-api.ts without importing it) ─────

let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string | null> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) return _tokenCache.token;
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${EBAY_API_BASE}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope%20https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope%2Fbuy.marketplace.insights',
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  const ttlMs = ((data.expires_in ?? 7200) - 300) * 1000;
  _tokenCache = { token: data.access_token, expiresAt: Date.now() + ttlMs };
  return data.access_token;
}

// ── Sold listings fetch ───────────────────────────────────────────────────────

interface SoldListing {
  price: number;
  soldDate: string;   // ISO string from eBay
}

async function fetchSoldListings(
  query: string,
  token: string,
  limit = 50,
): Promise<SoldListing[]> {
  const endpoint = `/buy/marketplace_insights/v1_beta/item_sales/search`
    + `?q=${encodeURIComponent(query)}&category_ids=212&limit=${limit}`;

  const res = await fetch(`${EBAY_API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
    cache: 'no-store',
  }).catch(() => null);

  if (!res?.ok) return [];

  const data = await res.json() as {
    itemSales?: Array<{
      lastSoldPrice?: { value?: string };
      lastSoldDate?: string;
      title?: string;
    }>;
  };

  return (data.itemSales ?? [])
    .filter(item => item.lastSoldPrice?.value && item.lastSoldDate)
    .map(item => ({
      price: parseFloat(item.lastSoldPrice!.value!),
      soldDate: item.lastSoldDate!,
    }))
    .filter(item => item.price > 0);
}

// ── Weekly bucketing ──────────────────────────────────────────────────────────

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

function buildWeeklyBuckets(listings: SoldListing[]): WeeklyPriceBucket[] {
  const byWeek = new Map<string, number[]>();
  for (const { price, soldDate } of listings) {
    const week = mondayOf(soldDate);
    const existing = byWeek.get(week) ?? [];
    existing.push(price);
    byWeek.set(week, existing);
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekOf, prices]) => ({
      weekOf,
      avgSoldPrice: parseFloat((prices.reduce((s, p) => s + p, 0) / prices.length).toFixed(2)),
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      sampleSize: prices.length,
    }));
}

// ── Milestone × price correlation ────────────────────────────────────────────

function avgInWindow(listings: SoldListing[], fromDate: string, toDate: string): number | null {
  const prices = listings
    .filter(l => l.soldDate >= fromDate && l.soldDate <= toDate)
    .map(l => l.price);
  if (prices.length < 2) return null; // need at least 2 data points for confidence
  return parseFloat((prices.reduce((s, p) => s + p, 0) / prices.length).toFixed(2));
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function buildMilestoneImpacts(
  milestones: MilestoneEvent[],
  allSoldListings: SoldListing[],
): MilestoneImpact[] {
  return milestones.map(milestone => {
    const eventDate = milestone.date;
    const baseline30dAvg = avgInWindow(allSoldListings, addDays(eventDate, -30), addDays(eventDate, -1));
    const post7dAvg      = avgInWindow(allSoldListings, eventDate,               addDays(eventDate,  7));
    const post14dAvg     = avgInWindow(allSoldListings, eventDate,               addDays(eventDate, 14));
    const post30dAvg     = avgInWindow(allSoldListings, eventDate,               addDays(eventDate, 30));

    const pctChange7d  = baseline30dAvg && post7dAvg
      ? parseFloat((((post7dAvg  - baseline30dAvg) / baseline30dAvg) * 100).toFixed(1))
      : null;
    const pctChange30d = baseline30dAvg && post30dAvg
      ? parseFloat((((post30dAvg - baseline30dAvg) / baseline30dAvg) * 100).toFixed(1))
      : null;

    return { milestone, baseline30dAvg, post7dAvg, post14dAvg, post30dAvg, pctChange7d, pctChange30d };
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

const SETS_TO_TRACK = [
  { set: 'Topps Series 1', query: (name: string, year: number) => `${name} ${year} Topps Series 1 RC PSA 10` },
  { set: 'Topps Update',   query: (name: string, year: number) => `${name} ${year} Topps Update RC PSA 10`   },
  { set: 'Topps Chrome',   query: (name: string, year: number) => `${name} ${year} Topps Chrome RC PSA 10`   },
  { set: 'Bowman 1st',     query: (name: string, year: number) => `${name} ${year} Bowman 1st PSA 10`        },
];

/**
 * Fetches 90 days of eBay sold history for a player's key card sets,
 * buckets prices by week, and correlates price movements with milestones.
 */
export async function getPlayerCardHistory(
  playerName: string,
  rcYear: number,
  milestones: MilestoneEvent[],
): Promise<PlayerCardHistory> {
  const token = await getToken();
  if (!token) return { playerName, sets: [], milestoneImpacts: [] };

  const setResults: SetPriceHistory[] = [];
  const allSoldListings: SoldListing[] = [];

  // Fetch each set sequentially to stay well within eBay rate limits
  for (const { set, query } of SETS_TO_TRACK) {
    const q = query(playerName, rcYear);
    const listings = await fetchSoldListings(q, token, 50);
    allSoldListings.push(...listings);
    if (listings.length > 0) {
      setResults.push({
        set,
        year: rcYear,
        weeklyBuckets: buildWeeklyBuckets(listings),
        rawListingCount: listings.length,
      });
    }
  }

  const milestoneImpacts = buildMilestoneImpacts(milestones, allSoldListings);

  return { playerName, sets: setResults, milestoneImpacts };
}
