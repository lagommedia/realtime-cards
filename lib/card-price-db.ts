/**
 * Database helpers for the card_price_history table.
 *
 * Schema (created by ensureTable()):
 *   card_price_history
 *     id             SERIAL PRIMARY KEY
 *     player_id      INTEGER NOT NULL
 *     player_name    TEXT NOT NULL
 *     card_query     TEXT NOT NULL   -- e.g. "Ohtani 2018 Topps Update PSA 10"
 *     grade          TEXT            -- e.g. "PSA 10"
 *     sale_price     NUMERIC(10,2)
 *     sale_date      DATE
 *     ebay_item_id   TEXT UNIQUE     -- deduplication key
 *     listing_title  TEXT
 *     collected_at   TIMESTAMPTZ DEFAULT NOW()
 */

import { pool } from '@/lib/db';
import { FoundSale } from '@/lib/ebay-finding';

export interface PricePoint {
  date: string;   // YYYY-MM-DD
  price: number;
}

// ── DDL ───────────────────────────────────────────────────────────────────────

export async function ensureTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS card_price_history (
      id            SERIAL PRIMARY KEY,
      player_id     INTEGER      NOT NULL,
      player_name   TEXT         NOT NULL,
      card_query    TEXT         NOT NULL,
      grade         TEXT,
      sale_price    NUMERIC(10,2) NOT NULL,
      sale_date     DATE         NOT NULL,
      ebay_item_id  TEXT         NOT NULL,
      listing_title TEXT,
      collected_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      CONSTRAINT card_price_history_ebay_item_id_key UNIQUE (ebay_item_id)
    );
    CREATE INDEX IF NOT EXISTS idx_cph_player_date
      ON card_price_history (player_id, sale_date DESC);
    CREATE INDEX IF NOT EXISTS idx_cph_query_date
      ON card_price_history (card_query, sale_date DESC);

    CREATE TABLE IF NOT EXISTS card_price_forecasts (
      id             SERIAL PRIMARY KEY,
      player_id      INTEGER      NOT NULL,
      player_name    TEXT         NOT NULL,
      card_query     TEXT         NOT NULL,
      forecast_date  DATE         NOT NULL,
      predicted_price NUMERIC(10,2) NOT NULL,
      confidence_low  NUMERIC(10,2),
      confidence_high NUMERIC(10,2),
      generated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      CONSTRAINT card_price_forecasts_unique UNIQUE (card_query, forecast_date)
    );
    CREATE INDEX IF NOT EXISTS idx_cpf_query_date
      ON card_price_forecasts (card_query, forecast_date ASC);
  `);
}

// ── Writes ────────────────────────────────────────────────────────────────────

export interface UpsertTarget {
  playerId: number;
  playerName: string;
  cardQuery: string;
  grade?: string | null;
  sales: FoundSale[];
}

/**
 * Upsert sold listings into card_price_history.
 * On conflict (duplicate ebay_item_id) — do nothing.
 * Returns the number of newly inserted rows.
 */
export async function upsertSales(target: UpsertTarget): Promise<number> {
  if (!target.sales.length) return 0;

  const values: unknown[] = [];
  const placeholders: string[] = [];

  target.sales.forEach((s, i) => {
    const base = i * 8;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`,
    );
    values.push(
      target.playerId,
      target.playerName,
      target.cardQuery,
      target.grade ?? null,
      s.salePrice,
      s.saleDate,
      s.ebayItemId,
      s.title,
    );
  });

  const result = await pool.query(
    `INSERT INTO card_price_history
       (player_id, player_name, card_query, grade, sale_price, sale_date, ebay_item_id, listing_title)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (ebay_item_id) DO NOTHING`,
    values,
  );

  return result.rowCount ?? 0;
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/**
 * Query price history from the DB for a given search query.
 * Falls back to the Marketplace Insights live API when the DB has no rows.
 */
export async function getPriceHistory(cardQuery: string): Promise<PricePoint[]> {
  const { rows } = await pool.query<{ sale_date: string; sale_price: string }>(
    `SELECT sale_date::text, sale_price::text
     FROM card_price_history
     WHERE card_query = $1
     ORDER BY sale_date ASC`,
    [cardQuery],
  );

  return rows.map(r => ({
    date:  r.sale_date.slice(0, 10),
    price: parseFloat(r.sale_price),
  }));
}

/**
 * Returns all unique (playerId, playerName, cardQuery, grade) combinations
 * tracked in users' collections — used by the cron job to know what to collect.
 */
export async function getTrackedCards(): Promise<
  Array<{ playerId: number; playerName: string; cardQuery: string; grade: string | null }>
> {
  // Derive queries from the cards table the same way CollectionContext does
  const { rows } = await pool.query<{
    player_id: number;
    player_name: string;
    year: number | null;
    set: string | null;
    grade: string | null;
    variant: string | null;
  }>(
    `SELECT DISTINCT
       "playerId"    AS player_id,
       "playerName"  AS player_name,
       year,
       set,
       grade,
       variant
     FROM cards`,
  );

  return rows.map(r => {
    const parts = [r.player_name, r.year, r.set, r.variant, r.grade].filter(Boolean);
    return {
      playerId:   r.player_id,
      playerName: r.player_name,
      cardQuery:  parts.join(' '),
      grade:      r.grade,
    };
  });
}

/**
 * Returns the most recent sale_date stored for a given query.
 * Used by the daily cron to fetch only new sales since the last run.
 */
export async function getLatestSaleDate(cardQuery: string): Promise<Date | null> {
  const { rows } = await pool.query<{ sale_date: string }>(
    `SELECT sale_date::text FROM card_price_history
     WHERE card_query = $1
     ORDER BY sale_date DESC LIMIT 1`,
    [cardQuery],
  );
  return rows[0] ? new Date(rows[0].sale_date) : null;
}

// ── Forecasts ─────────────────────────────────────────────────────────────────

export interface ForecastPoint {
  date: string;
  price: number;
  low: number | null;
  high: number | null;
}

export interface ForecastRow {
  cardQuery: string;
  date: string;
  predictedPrice: number;
  confidenceLow: number | null;
  confidenceHigh: number | null;
}

export async function upsertForecasts(
  playerId: number,
  playerName: string,
  cardQuery: string,
  points: ForecastRow[],
): Promise<void> {
  if (!points.length) return;
  const values: unknown[] = [];
  const placeholders: string[] = [];
  points.forEach((p, i) => {
    const base = i * 7;
    placeholders.push(`($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7})`);
    values.push(
      playerId,
      playerName,
      cardQuery,
      p.date,
      p.predictedPrice,
      p.confidenceLow  ?? null,
      p.confidenceHigh ?? null,
    );
  });
  await pool.query(
    `INSERT INTO card_price_forecasts
       (player_id, player_name, card_query, forecast_date, predicted_price, confidence_low, confidence_high)
     VALUES ${placeholders.join(',')}
     ON CONFLICT (card_query, forecast_date) DO UPDATE
       SET predicted_price  = EXCLUDED.predicted_price,
           confidence_low   = EXCLUDED.confidence_low,
           confidence_high  = EXCLUDED.confidence_high,
           generated_at     = NOW()`,
    values,
  );
}

export async function getForecast(cardQuery: string): Promise<ForecastPoint[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { rows } = await pool.query<{
    forecast_date: string;
    predicted_price: string;
    confidence_low: string | null;
    confidence_high: string | null;
  }>(
    `SELECT forecast_date::text, predicted_price::text, confidence_low::text, confidence_high::text
     FROM card_price_forecasts
     WHERE card_query = $1 AND forecast_date >= $2
     ORDER BY forecast_date ASC`,
    [cardQuery, today],
  );
  return rows.map(r => ({
    date:  r.forecast_date.slice(0, 10),
    price: parseFloat(r.predicted_price),
    low:   r.confidence_low  ? parseFloat(r.confidence_low)  : null,
    high:  r.confidence_high ? parseFloat(r.confidence_high) : null,
  }));
}

// Returns cards that have enough history to forecast (≥20 sale points)
// and haven't had a forecast generated in the last 7 days.
export async function getCardsNeedingForecast(): Promise<
  Array<{ playerId: number; playerName: string; cardQuery: string; pointCount: number }>
> {
  const { rows } = await pool.query<{
    player_id: number;
    player_name: string;
    card_query: string;
    point_count: number;
  }>(`
    SELECT h.player_id, h.player_name, h.card_query, COUNT(*)::int AS point_count
    FROM card_price_history h
    WHERE NOT EXISTS (
      SELECT 1 FROM card_price_forecasts f
      WHERE f.card_query = h.card_query
        AND f.generated_at > NOW() - INTERVAL '7 days'
    )
    GROUP BY h.player_id, h.player_name, h.card_query
    HAVING COUNT(*) >= 20
    ORDER BY COUNT(*) DESC
    LIMIT 100
  `);
  return rows.map(r => ({
    playerId:   r.player_id,
    playerName: r.player_name,
    cardQuery:  r.card_query,
    pointCount: r.point_count,
  }));
}
