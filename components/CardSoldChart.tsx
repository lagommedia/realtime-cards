'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { CollectionCard } from '@/context/CollectionContext';

type TimeRange = '7D' | '14D' | '30D' | '90D' | 'YTD' | '1Y' | 'ALL';
const RANGES: TimeRange[] = ['7D', '14D', '30D', '90D', 'YTD', '1Y', 'ALL'];

interface SoldPoint  { date: string; price: number }
interface ForecastPt { date: string; price: number; low: number | null; high: number | null }

// Unified chart point: historical has `actual`, forecast has `forecast`/`fcLow`/`fcHigh`
interface ChartPoint {
  date:     string;
  actual?:  number;
  forecast?: number;
  fcLow?:   number;
  fcHigh?:  number;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtFull(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
}

function rangeCutoff(r: TimeRange): Date | null {
  const now = new Date();
  switch (r) {
    case '7D':  return new Date(now.getTime() - 7   * 86400000);
    case '14D': return new Date(now.getTime() - 14  * 86400000);
    case '30D': return new Date(now.getTime() - 30  * 86400000);
    case '90D': return new Date(now.getTime() - 90  * 86400000);
    case 'YTD': return new Date(new Date().getFullYear(), 0, 1);
    case '1Y':  return new Date(now.getTime() - 365 * 86400000);
    case 'ALL': return null;
  }
}

export default function CardSoldChart({
  card,
  query: queryOverride,
  playerId: playerIdOverride,
  purchasePrice: purchasePriceOverride,
  height = 148,
}: {
  card?: CollectionCard;
  query?: string;
  playerId?: number;
  purchasePrice?: number | null;
  height?: number;
}) {
  const resolvedPlayerId      = card?.playerId ?? playerIdOverride ?? 0;
  const resolvedPurchasePrice = card?.purchasePrice ?? purchasePriceOverride ?? null;
  const resolvedPriceHistory  = card?.priceHistory ?? [];

  const [allPoints, setAllPoints]     = useState<SoldPoint[] | null>(null);
  const [forecast,  setForecast]      = useState<ForecastPt[]>([]);
  const [loading,   setLoading]       = useState(true);
  const [range,     setRange]         = useState<TimeRange>('90D');

  const depKey = card?.id ?? queryOverride ?? '';

  useEffect(() => {
    const q = queryOverride
      ?? [card?.playerName, card?.year, card?.set, card?.grade].filter(Boolean).join(' ');
    if (!q) { setLoading(false); return; }
    setLoading(true);
    setAllPoints(null);
    setForecast([]);
    fetch(`/api/player/${resolvedPlayerId}/card-history?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then((d: { points?: SoldPoint[]; forecast?: ForecastPt[] }) => {
        setAllPoints(d.points ?? []);
        setForecast(d.forecast ?? []);
      })
      .catch(() => { setAllPoints([]); setForecast([]); })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  const source = useMemo((): SoldPoint[] => {
    if (allPoints && allPoints.length > 0) return allPoints;
    return resolvedPriceHistory
      .map(h => ({ date: h.date.split('T')[0], price: h.value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [allPoints, resolvedPriceHistory]);

  // Merge historical + forecast into a unified sorted array for the chart
  const { chartData, pts, lastSale, pctChange, salesCount, avg365 } = useMemo(() => {
    const cutoff = rangeCutoff(range);
    const pts = cutoff
      ? source.filter(p => new Date(p.date + 'T00:00:00') >= cutoff)
      : source;

    const firstPrice = pts[0]?.price ?? null;
    const lastSale   = pts.at(-1)?.price ?? null;
    const salesCount = pts.length;
    const pctChange  = firstPrice && lastSale ? ((lastSale - firstPrice) / firstPrice) * 100 : null;

    const yearCutoff = new Date(Date.now() - 365 * 86400000);
    const yearPts    = source.filter(p => new Date(p.date + 'T00:00:00') >= yearCutoff);
    const avg365     = yearPts.length > 0
      ? yearPts.reduce((s, p) => s + p.price, 0) / yearPts.length
      : null;

    // Build unified chart data: historical points + bridge point + forecast points
    const historicalMap = new Map<string, ChartPoint>();
    for (const p of pts) {
      historicalMap.set(p.date, { date: p.date, actual: p.price });
    }

    // Add forecast points (only future dates — past forecast dates are filtered server-side)
    const forecastMap = new Map<string, ChartPoint>();
    for (const f of forecast) {
      forecastMap.set(f.date, {
        date:     f.date,
        forecast: f.price,
        fcLow:    f.low ?? undefined,
        fcHigh:   f.high ?? undefined,
      });
    }

    // Bridge: anchor the forecast line to the last historical actual price
    // so the dashed line starts exactly where the solid line ends
    if (forecast.length > 0 && pts.length > 0) {
      const lastHistoricalPt = pts.at(-1)!;
      const bridgeDate = lastHistoricalPt.date;
      const existing = historicalMap.get(bridgeDate) ?? { date: bridgeDate };
      historicalMap.set(bridgeDate, {
        ...existing,
        forecast: lastHistoricalPt.price,
        fcLow:    lastHistoricalPt.price,
        fcHigh:   lastHistoricalPt.price,
      });
    }

    const allDates = [...new Set([
      ...historicalMap.keys(),
      ...forecastMap.keys(),
    ])].sort();

    const chartData: ChartPoint[] = allDates.map(date => ({
      ...(historicalMap.get(date) ?? {}),
      ...(forecastMap.get(date)   ?? {}),
      date,
    }));

    return { chartData, pts, lastSale, pctChange, salesCount, avg365 };
  }, [source, forecast, range]);

  const yDomain = useMemo((): [number, number] => {
    const allPrices: number[] = [];
    for (const p of chartData) {
      if (p.actual  !== undefined) allPrices.push(p.actual);
      if (p.fcHigh  !== undefined) allPrices.push(p.fcHigh);
      if (p.fcLow   !== undefined) allPrices.push(p.fcLow);
    }
    if (!allPrices.length) return [0, 100];
    const lo = Math.min(...allPrices);
    const hi = Math.max(...allPrices);
    const pad = (hi - lo) * 0.14 || hi * 0.14 || 5;
    return [Math.max(0, lo - pad), hi + pad];
  }, [chartData]);

  const hasForecast = forecast.length > 0;
  const isUp    = pctChange !== null && pctChange >= 0;
  const gradId  = `csc-${card?.id ?? queryOverride ?? resolvedPlayerId}`;
  const fcGradId = `fcg-${card?.id ?? queryOverride ?? resolvedPlayerId}`;

  if (loading) {
    return (
      <div style={{ height: height + 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 18, height: 18,
          border: '2px solid #e2e8f0', borderTopColor: '#4F46E5',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  if (pts.length === 0) {
    return (
      <div style={{
        height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        background: '#f8fafc', borderRadius: 10, border: '1px dashed #e2e8f0',
      }}>
        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
          No recent eBay sales found
        </p>
        <p style={{ fontSize: 10, color: '#cbd5e1', textAlign: 'center' }}>
          eBay data coverage varies by card
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Stats chips ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <div style={{ flex: 1.2, background: '#f8fafc', borderRadius: 10, padding: '9px 11px', minWidth: 0 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
            Last Sale
          </p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lastSale !== null ? fmt(lastSale) : '—'}
          </p>
          {pctChange !== null && (
            <p style={{ fontSize: 10, fontWeight: 700, color: isUp ? '#16a34a' : '#dc2626', marginTop: 2 }}>
              {isUp ? '+' : ''}{pctChange.toFixed(1)}%
            </p>
          )}
        </div>

        <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '9px 11px', minWidth: 0 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
            # of Sales
          </p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
            {salesCount}
          </p>
        </div>

        <div style={{ flex: 1.2, background: '#f8fafc', borderRadius: 10, padding: '9px 11px', minWidth: 0 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
            365D Avg
          </p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {avg365 !== null ? fmt(avg365) : '—'}
          </p>
        </div>
      </div>

      {/* ── AI Forecast badge ────────────────────────────────────────────────── */}
      {hasForecast && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="20" height="6">
              <line x1="0" y1="3" x2="20" y2="3" stroke="#7C3AED" strokeWidth="2" strokeDasharray="4 2" />
            </svg>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              AI Forecast
            </span>
          </div>
          <span style={{ fontSize: 9, color: '#94a3b8' }}>30-day projection</span>
        </div>
      )}

      {/* ── Chart ───────────────────────────────────────────────────────────── */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 44, bottom: 0, left: 0 }}>
            <defs>
              {/* Historical area gradient */}
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#4F46E5" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#4F46E5" stopOpacity={0}    />
              </linearGradient>
              {/* Forecast confidence band gradient */}
              <linearGradient id={fcGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#7C3AED" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.04} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmtDate}
              interval="preserveStartEnd"
              height={18}
            />
            <YAxis
              domain={yDomain}
              allowDataOverflow
              orientation="right"
              tickCount={2}
              width={44}
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`
              }
            />

            {/* Purchase price reference line */}
            {resolvedPurchasePrice !== null && resolvedPurchasePrice > 0 && (
              <ReferenceLine
                y={resolvedPurchasePrice}
                stroke="#f59e0b"
                strokeDasharray="3 3"
                strokeWidth={1.5}
              />
            )}

            {/* Historical area (solid indigo) */}
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#4F46E5"
              strokeWidth={2}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 4, fill: '#4F46E5', stroke: '#fff', strokeWidth: 2 }}
              connectNulls={false}
              animationDuration={500}
            />

            {/* Forecast confidence band (filled area between fcLow and fcHigh) */}
            {hasForecast && (
              <Area
                type="monotone"
                dataKey="fcHigh"
                stroke="none"
                fill={`url(#${fcGradId})`}
                dot={false}
                activeDot={false}
                connectNulls
                animationDuration={500}
                legendType="none"
              />
            )}
            {hasForecast && (
              <Area
                type="monotone"
                dataKey="fcLow"
                stroke="none"
                fill="#fff"
                dot={false}
                activeDot={false}
                connectNulls
                animationDuration={500}
                legendType="none"
              />
            )}

            {/* Forecast center line (dashed purple) */}
            {hasForecast && (
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#7C3AED"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                activeDot={{ r: 3, fill: '#7C3AED', stroke: '#fff', strokeWidth: 2 }}
                connectNulls
                animationDuration={500}
              />
            )}

            <Tooltip
              cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const pt = payload[0]?.payload as ChartPoint;
                const isFC = pt.actual === undefined && pt.forecast !== undefined;
                return (
                  <div style={{
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                    padding: '6px 10px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                  }}>
                    {pt.actual !== undefined && (
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{fmtFull(pt.actual)}</p>
                    )}
                    {isFC && pt.forecast !== undefined && (
                      <>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#7C3AED' }}>{fmtFull(pt.forecast)}</p>
                        {pt.fcLow !== undefined && pt.fcHigh !== undefined && (
                          <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
                            Range: {fmtFull(pt.fcLow)} – {fmtFull(pt.fcHigh)}
                          </p>
                        )}
                        <p style={{ fontSize: 10, color: '#7C3AED', marginTop: 1, fontWeight: 600 }}>AI Forecast</p>
                      </>
                    )}
                    <p style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                      {isFC ? 'Projected' : 'Sold'} · {fmtDate(pt.date)}
                    </p>
                  </div>
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Time range tabs ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 2, marginTop: 8, justifyContent: 'center' }}>
        {RANGES.map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            style={{
              padding: '4px 9px', borderRadius: 6,
              fontSize: 11, fontWeight: 700,
              background: r === range ? '#4F46E5' : 'transparent',
              color: r === range ? '#fff' : '#94a3b8',
              transition: 'all 0.15s',
            }}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
