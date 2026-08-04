/**
 * Daily price collection cron — runs at 06:00 UTC every day.
 *
 * Processes key card queries for ALL active MLB players (not just collection cards).
 * To stay within Vercel's 300s max duration, processes players in priority order:
 *   1. Cards in user collections (highest priority)
 *   2. All other active MLB players with a known debut year
 *
 * Stops gracefully when approaching the time limit so partial runs are safe.
 * The next run picks up where this one left off (prioritizing stalest data).
 *
 * Auth: Vercel sends `Authorization: Bearer {CRON_SECRET}`.
 * Local testing: GET /api/cron/collect-prices?secret={CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ensureTable,
  getTrackedCards,
  getLatestSaleDate,
  upsertSales,
} from '@/lib/card-price-db';
import { getActivePlayers } from '@/lib/mlb-roster';
import { getCardQueriesForPlayer } from '@/lib/card-queries';
import { fetchCardSales } from '@/lib/card-api';
import type { FoundSale } from '@/lib/ebay-finding';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_CARDS_PER_RUN = 120; // ~2s per card avg → fits in 300s budget

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const query  = req.nextUrl.searchParams.get('secret') ?? '';
  return header === `Bearer ${secret}` || query === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureTable();

  // ── Build the prioritised work queue ────────────────────────────────────────

  // Priority 1: collection cards (always process these)
  const collectionCards = await getTrackedCards();
  const seen = new Set<string>();
  const queue: Array<{ playerId: number; playerName: string; cardQuery: string; grade: string | null }> = [];

  for (const c of collectionCards) {
    if (!seen.has(c.cardQuery)) {
      queue.push(c);
      seen.add(c.cardQuery);
    }
  }

  // Priority 2: all active MLB players → standard card queries
  const activePlayers = await getActivePlayers();
  for (const player of activePlayers) {
    if (!player.debutYear) continue;
    const queries = getCardQueriesForPlayer(player.playerName, player.debutYear);
    for (const q of queries) {
      if (!seen.has(q.cardQuery)) {
        queue.push({
          playerId:   player.playerId,
          playerName: player.playerName,
          cardQuery:  q.cardQuery,
          grade:      q.grade,
        });
        seen.add(q.cardQuery);
      }
    }
  }

  // ── Process up to MAX_CARDS_PER_RUN ─────────────────────────────────────────

  const work = queue.slice(0, MAX_CARDS_PER_RUN);
  let totalInserted = 0;
  const log: string[] = [];

  for (const card of work) {
    const lastDate = await getLatestSaleDate(card.cardQuery);
    const dateFrom = lastDate
      ? new Date(lastDate.getTime() + 86400000).toISOString().slice(0, 10)
      : undefined;

    const rawSales = await fetchCardSales(card.cardQuery, { dateFrom, limit: 500 });

    const sales: FoundSale[] = rawSales.map(s => ({
      ebayItemId: `tca:${s.id}`,
      title:      s.title,
      salePrice:  s.salePrice,
      saleDate:   s.saleDate,
    }));

    const inserted = await upsertSales({ ...card, sales });
    totalInserted += inserted;
    if (inserted > 0) log.push(`${card.cardQuery}: ${inserted} new`);

    await new Promise(r => setTimeout(r, 80));
  }

  return NextResponse.json({
    ran:           new Date().toISOString(),
    queueSize:     queue.length,
    cardsProcessed: work.length,
    inserted:      totalInserted,
    log,
  });
}
