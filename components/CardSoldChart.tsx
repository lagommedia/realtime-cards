'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart, Line, Area, ReferenceLine,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { CollectionCard } from '@/context/CollectionContext';

interface SoldPoint {
  date: string;
  price: number;
}

interface ChartPoint {
  date: string;
  actual: number | null;
  proj: number | null;
  bandBase: number;
  bandRange: number;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function fmtDateShort(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function linearRegression(pts: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = pts.length;
  if (n < 2) return { slope: 0, intercept: pts[0]?.y ?? 0 };
  const sumX = pts.reduce((s, p) => s + p.x, 0);
  const sumY = pts.reduce((s, p) => s + p.y, 0);
  const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return { slope: 0, intercept: sumY / n };
  return {
    slope: (n * sumXY - sumX * sumY) / denom,
    intercept: (sumY - sumX * ((n * sumXY - sumX * sumY) / denom)) / n,
  };
}

export default function CardSoldChart({ card }: { card: CollectionCard }) {
  const [soldPoints, setSoldPoints] = useState<SoldPoint[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const parts = [card.playerName, card.year, card.set, card.grade].filter(Boolean);
    const q = parts.join(' ');
    fetch(`/api/player/${card.playerId}/card-history?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then((d: { points?: SoldPoint[] }) => setSoldPoints(d.points ?? []))
      .catch(() => setSoldPoints([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  // Use eBay sold data when available, fall back to locally stored priceHistory snapshots
  const mergedPoints = useMemo((): SoldPoint[] => {
    if (soldPoints && soldPoints.length > 0) return soldPoints;
    return card.priceHistory
      .map(h => ({ date: h.date.split('T')[0], price: h.value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [soldPoints, card.priceHistory]);

  const isEbayData = (soldPoints?.length ?? 0) > 0;

  const { chartData, lineColor, nowDate, projectedFinalPrice } = useMemo(() => {
    if (mergedPoints.length === 0) {
      return { chartData: [], lineColor: '#3b82f6', nowDate: '', projectedFinalPrice: null };
    }

    const nowDate = mergedPoints.at(-1)!.date;
    const firstTs = new Date(mergedPoints[0].date + 'T12:00:00').getTime();

    const regPts = mergedPoints.map(p => ({
      x: (new Date(p.date + 'T12:00:00').getTime() - firstTs) / 86400000,
      y: p.price,
    }));
    const { slope, intercept } = linearRegression(regPts);

    const lastX = regPts.at(-1)!.x;
    const lastPrice = mergedPoints.at(-1)!.price;
    const projWeek4 = Math.max(0.01, intercept + slope * (lastX + 28));

    // Green if the trend goes up OR current value is already above purchase price
    const lineColor = (slope >= 0 || lastPrice >= card.purchasePrice) ? '#16a34a' : '#dc2626';

    // Historical points: zero-width band (invisible) so stacking starts clean
    const historical: ChartPoint[] = mergedPoints.map((p, i) => ({
      date: p.date,
      actual: p.price,
      // Bridge last actual point into the dashed projection line
      proj: i === mergedPoints.length - 1 ? p.price : null,
      bandBase: p.price,
      bandRange: 0,
    }));

    // 4-week projection with widening confidence band
    const projPoints: ChartPoint[] = [1, 2, 3, 4].map(w => {
      const x = lastX + w * 7;
      const projPrice = Math.max(0.01, intercept + slope * x);
      const bandHalf = projPrice * (0.07 + (w - 1) * 0.025); // 7%, 9.5%, 12%, 14.5%
      const d = new Date(nowDate + 'T12:00:00');
      d.setDate(d.getDate() + w * 7);
      return {
        date: d.toISOString().split('T')[0],
        actual: null,
        proj: projPrice,
        bandBase: Math.max(0, projPrice - bandHalf),
        bandRange: bandHalf * 2,
      };
    });

    return { chartData: [...historical, ...projPoints], lineColor, nowDate, projectedFinalPrice: projWeek4 };
  }, [mergedPoints, card.purchasePrice]);

  const yDomain = useMemo(() => {
    const vals = chartData.flatMap(d => [
      d.actual,
      d.proj,
      d.bandRange > 0 ? d.bandBase : null,
      d.bandRange > 0 ? d.bandBase + d.bandRange : null,
    ].filter((v): v is number => v != null));
    vals.push(card.purchasePrice);
    if (vals.length === 0) return [0, 100];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = (hi - lo) * 0.14 || hi * 0.14 || 5;
    return [Math.max(0, lo - pad), hi + pad];
  }, [chartData, card.purchasePrice]);

  if (loading) {
    return (
      <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 18, height: 18,
          border: '2px solid #e2e8f0', borderTopColor: '#3b82f6',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  if (mergedPoints.length === 0) {
    return (
      <div style={{
        height: 76, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f8fafc', borderRadius: 10, border: '1px dashed #e2e8f0',
      }}>
        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 1.5 }}>
          No price history yet.{' '}
          <span style={{ color: '#64748b' }}>Refresh the card to start tracking.</span>
        </p>
      </div>
    );
  }

  if (mergedPoints.length < 2) {
    return (
      <div style={{
        height: 76, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f8fafc', borderRadius: 10, border: '1px dashed #e2e8f0',
      }}>
        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 1.5 }}>
          Only one price snapshot so far.{' '}
          <span style={{ color: '#64748b' }}>More history will accumulate over time.</span>
        </p>
      </div>
    );
  }

  const showDots = mergedPoints.length <= 20;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Price History &amp; Forecast
        </p>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>
          {isEbayData
            ? `${mergedPoints.length} sold${mergedPoints.length === 1 ? '' : 's'} · eBay`
            : 'local snapshots'}
        </span>
      </div>

      {/* Chart */}
      <div style={{ height: 148 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 46, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmtDateShort}
              interval={Math.max(1, Math.floor(chartData.length / 5))}
              height={18}
            />
            <YAxis
              domain={yDomain}
              allowDataOverflow
              orientation="right"
              tickCount={4}
              width={46}
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `$${v < 10 ? v.toFixed(2) : v.toFixed(0)}`}
            />

            {/* Purchase price reference line */}
            <ReferenceLine
              y={card.purchasePrice}
              stroke="#f59e0b"
              strokeDasharray="3 3"
              strokeWidth={1.5}
            />

            {/* NOW divider */}
            <ReferenceLine
              x={nowDate}
              stroke="#cbd5e1"
              strokeDasharray="3 4"
              strokeWidth={1}
            />

            {/* Confidence band — stacked: base (transparent) + range (filled) */}
            <Area
              dataKey="bandBase"
              stackId="ci"
              stroke="none"
              fill="transparent"
              isAnimationActive={false}
              dot={false}
              legendType="none"
            />
            <Area
              dataKey="bandRange"
              stackId="ci"
              stroke="none"
              fill={lineColor}
              fillOpacity={0.13}
              isAnimationActive={false}
              dot={false}
              legendType="none"
            />

            {/* Actual sold price line */}
            <Line
              dataKey="actual"
              stroke={lineColor}
              strokeWidth={2}
              dot={showDots ? { r: 2.5, fill: lineColor, strokeWidth: 0 } : false}
              activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
              connectNulls={false}
              animationDuration={600}
              animationEasing="ease-out"
            />

            {/* Projected dashed line */}
            <Line
              dataKey="proj"
              stroke={lineColor}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              strokeOpacity={0.72}
              dot={false}
              activeDot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
              connectNulls={false}
              animationDuration={900}
              animationEasing="ease-out"
            />

            <Tooltip
              cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const pt = payload[0]?.payload as ChartPoint;
                const price = pt.actual ?? pt.proj;
                if (price == null) return null;
                const isProj = pt.actual == null;
                return (
                  <div style={{
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                    padding: '6px 10px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                    minWidth: 130,
                  }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{fmt(price)}</p>
                    <p style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                      {isProj ? `Projected · ` : `Sold · `}{fmtDateShort(pt.date)}
                    </p>
                    {isProj && pt.bandRange > 0 && (
                      <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                        Range: {fmt(pt.bandBase)}–{fmt(pt.bandBase + pt.bandRange)}
                      </p>
                    )}
                  </div>
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 14, height: 2.5, borderRadius: 2, background: lineColor }} />
          <span style={{ fontSize: 10, color: '#94a3b8' }}>Actual sold</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="14" height="5" style={{ display: 'block' }}>
            <line x1="0" y1="2.5" x2="14" y2="2.5" stroke={lineColor} strokeWidth="1.5" strokeDasharray="4 3" strokeOpacity="0.72" />
          </svg>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>4-wk forecast</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 14, height: 1.5, background: '#f59e0b', borderRadius: 2 }} />
          <span style={{ fontSize: 10, color: '#94a3b8' }}>Paid {fmt(card.purchasePrice)}</span>
        </div>
        {projectedFinalPrice != null && card.currentValue != null && (
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: lineColor }}>
              {projectedFinalPrice >= card.currentValue ? '▲' : '▼'} {fmt(projectedFinalPrice)} proj.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
