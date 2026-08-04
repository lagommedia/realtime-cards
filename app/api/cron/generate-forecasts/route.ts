/**
 * AI price forecast generation cron.
 *
 * For each card with ≥20 historical sale points and no fresh forecast (within 7 days),
 * calls the Claude API with the sale history + current MLB season context to generate
 * a 30-day forward price projection with confidence bands. Results are stored in
 * card_price_forecasts for display in CardSoldChart.
 *
 * Vercel schedule: weekly (Sunday 07:00 UTC) — see vercel.json.
 * Auth: GET /api/cron/generate-forecasts?secret={CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  ensureTable,
  getCardsNeedingForecast,
  getPriceHistory,
  upsertForecasts,
} from '@/lib/card-price-db';
import type { ForecastRow } from '@/lib/card-price-db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_CARDS_PER_RUN = 20;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const query  = req.nextUrl.searchParams.get('secret') ?? '';
  return header === `Bearer ${secret}` || query === secret;
}

interface ForecastPoint {
  date: string;       // YYYY-MM-DD
  price: number;
  low: number;
  high: number;
}

interface ClaudeResponse {
  forecast: ForecastPoint[];
}

async function generateForecastForCard(
  client: Anthropic,
  cardQuery: string,
  history: Array<{ date: string; price: number }>,
): Promise<ForecastPoint[]> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Build 30 future dates (daily for next 30 days)
  const futureDates: string[] = [];
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    futureDates.push(d.toISOString().slice(0, 10));
  }

  // Trim history to last 90 points to keep prompt focused
  const recentHistory = history.slice(-90);

  const prompt = `You are a sports card market analyst. Based on the following eBay sold price history for "${cardQuery}", generate a 30-day price forecast.

Historical sales data (date, price):
${recentHistory.map(p => `${p.date}: $${p.price.toFixed(2)}`).join('\n')}

Today's date: ${todayStr}

Forecast dates needed: ${futureDates.join(', ')}

Instructions:
- Analyze the trend, seasonality (baseball season May–October is peak demand), and price volatility in the historical data
- Consider that card prices correlate with player performance: rookies/stars in hot streaks see price spikes
- Generate a realistic forecast that reflects market momentum
- Provide confidence bands (low/high) that capture typical price variance (±15-30% is typical for graded cards)
- Return ONLY a JSON object with this exact structure, no markdown, no explanation:
{
  "forecast": [
    {"date": "YYYY-MM-DD", "price": 123.45, "low": 100.00, "high": 150.00},
    ...
  ]
}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('');

  // Parse JSON — strip any stray markdown fences
  const jsonStr = text.replace(/```(?:json)?\n?/g, '').trim();
  const parsed = JSON.parse(jsonStr) as ClaudeResponse;

  if (!Array.isArray(parsed.forecast)) {
    throw new Error('Claude response missing forecast array');
  }

  return parsed.forecast.map(p => ({
    date:  p.date,
    price: Number(p.price),
    low:   Number(p.low),
    high:  Number(p.high),
  }));
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  await ensureTable();

  const client = new Anthropic({ apiKey });
  const cards   = await getCardsNeedingForecast();
  const work    = cards.slice(0, MAX_CARDS_PER_RUN);

  let success = 0;
  let failed  = 0;
  const log: string[] = [];

  for (const card of work) {
    try {
      const history = await getPriceHistory(card.cardQuery);
      if (history.length < 20) {
        log.push(`${card.cardQuery}: skipped (only ${history.length} points)`);
        continue;
      }

      const forecast = await generateForecastForCard(client, card.cardQuery, history);

      const rows: ForecastRow[] = forecast.map(p => ({
        cardQuery:      card.cardQuery,
        date:           p.date,
        predictedPrice: p.price,
        confidenceLow:  p.low,
        confidenceHigh: p.high,
      }));

      await upsertForecasts(card.playerId, card.playerName, card.cardQuery, rows);
      success++;
      log.push(`${card.cardQuery}: ${forecast.length} forecast points saved`);
    } catch (err) {
      failed++;
      log.push(`${card.cardQuery}: ERROR — ${(err as Error).message?.slice(0, 80)}`);
    }

    // Small delay to stay within API rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  return NextResponse.json({
    ran:           new Date().toISOString(),
    cardsEligible: cards.length,
    cardsProcessed: work.length,
    success,
    failed,
    log,
  });
}
