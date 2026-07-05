'use client';

import { useTeam } from '@/context/TeamContext';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';

interface Props {
  data: { date: string; price: number }[];
  currentPrice: number;
}

export default function PriceChart({ data, currentPrice }: Props) {
  const { theme } = useTeam();

  const prices = data.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const isPositiveTrend = data[data.length - 1]?.price >= data[0]?.price;
  const lineColor = isPositiveTrend ? '#22c55e' : '#ef4444';

  const formatted = data.map((d, i) => ({
    ...d,
    label: i % 7 === 0 ? d.date.slice(5) : '',
  }));

  return (
    <div className="rounded-2xl p-4 border border-white/10" style={{ backgroundColor: theme.cardBackground }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white">30-Day Price History</p>
        <p className="text-xs text-gray-400">Avg: ${currentPrice.toFixed(2)}</p>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={formatted} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lineColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[minPrice * 0.9, maxPrice * 1.1]}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#fff',
            }}
            formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Price']}
            labelFormatter={(label) => label || ''}
          />
          <ReferenceLine y={currentPrice} stroke="#ffffff30" strokeDasharray="4 4" />
          <Area
            type="monotone"
            dataKey="price"
            stroke={lineColor}
            strokeWidth={2}
            fill="url(#priceGradient)"
            dot={false}
            activeDot={{ r: 4, fill: lineColor }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
