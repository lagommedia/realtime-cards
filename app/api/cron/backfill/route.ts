/**
 * Historical backfill — pulls all available sold history for every active MLB
 * player's standard card queries and stores it in card_price_history.
 *
 * Run once after subscribing to a plan with a larger lookback window (e.g. the
 * Pro 7-day trial gives 90-day history / 200,000 records per day).
 *
 * Safe to run repeatedly — upserts by dedup key, no double-counting.
 * Processes up to MAX_CARDS cards per call; stagger runs to cover all players.
 *
 * Auth: GET /api/cron/backfill?secret={CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureTable, getTrackedCards, upsertSales } from '@/lib/card-price-db';
import { getActivePlayers } from '@/lib/mlb-roster';
import { getCardQueriesForPlayer } from '@/lib/card-queries';
import { fetchCardSales } from '@/lib/card-api';
import type { FoundSale } from '@/lib/ebay-finding';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_CARDS = 60; // limit per run; re-run to process more

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

  // Optional: offset=N skips the first N cards so you can page through
  const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10);

  // ── Build unified work queue (collection-first, then all active players) ──
  const collectionCards = await getTrackedCards();
  const seen = new Set<string>();
  const queue: Array<{ playerId: number; playerName: string; cardQuery: string; grade: string | null }> = [];

  for (const c of collectionCards) {
    if (!seen.has(c.cardQuery)) {
      queue.push(c);
      seen.add(c.cardQuery);
    }
  }

  const activePlayers = await getActivePlayers();
  for (const player of activePlayers) {
    if (!player.debutYear) continue;
    for (const q of getCardQueriesForPlayer(player.playerName, player.debutYear)) {
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

  const work = queue.slice(offset, offset + MAX_CARDS);
  let totalInserted = 0;
  const log: string[] = [];

  for (const card of work) {
    const rawSales = await fetchCardSales(card.cardQuery, { limit: 1000 });

    const sales: FoundSale[] = rawSales.map(s => ({
      ebayItemId: `tca:${s.id}`,
      title:      s.title,
      salePrice:  s.salePrice,
      saleDate:   s.saleDate,
    }));

    const inserted = await upsertSales({ ...card, sales });
    totalInserted += inserted;
    log.push(`${card.cardQuery}: ${rawSales.length} fetched, ${inserted} stored`);

    await new Promise(r => setTimeout(r, 200));
  }

  const nextOffset = offset + work.length;
  const hasMore    = nextOffset < queue.length;

  return NextResponse.json({
    ran:            new Date().toISOString(),
    queueSize:      queue.length,
    offset,
    cardsProcessed: work.length,
    inserted:       totalInserted,
    hasMore,
    nextOffset:     hasMore ? nextOffset : null,
    log,
  });
}
