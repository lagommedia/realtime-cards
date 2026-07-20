'use client';

import { HofResult, HofBenchmark } from '@/lib/hof-probability';

// SVG arc gauge constants (270° sweep)
const R = 65;
const CX = 82;
const CY = 86;
const CIRC = 2 * Math.PI * R;         // ≈ 408.4
const TRACK = CIRC * 0.75;            // 270° portion ≈ 306.3
const GAP   = CIRC - TRACK;           // remaining ≈ 102.1

function fmt(b: HofBenchmark): string {
  if (b.unit === 'AVG' || b.unit === 'OPS' || b.unit === 'ERA' || b.unit === 'WHIP') {
    return b.current.toFixed(3).replace(/^0/, '');
  }
  return Math.round(b.current).toLocaleString();
}

function fmtProjected(b: HofBenchmark): string {
  if (b.unit === 'AVG' || b.unit === 'OPS' || b.unit === 'ERA' || b.unit === 'WHIP') {
    return b.projected.toFixed(3).replace(/^0/, '');
  }
  return Math.round(b.projected).toLocaleString();
}

function fmtTarget(b: HofBenchmark): string {
  if (b.unit === 'AVG' || b.unit === 'OPS') return b.target.toFixed(3).replace(/^0/, '');
  if (b.unit === 'ERA' || b.unit === 'WHIP') return b.target.toFixed(2);
  return b.target.toLocaleString();
}

function BenchmarkBar({ b, tierColor }: { b: HofBenchmark; tierColor: string }) {
  // For lower-is-better (ERA/WHIP), display bar fills in reverse visually
  const fillPct = Math.max(0, Math.min(1, b.pct));
  const showProjected = b.higherIsBetter && b.projected > b.current + 1;

  const projectedPct = b.higherIsBetter
    ? Math.max(0, Math.min(1, b.projected / b.target))
    : fillPct;

  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs font-semibold text-gray-300">{b.label}</span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-bold text-white tabular-nums">{fmt(b)}</span>
          {showProjected && (
            <span className="text-xs text-gray-500 tabular-nums">→ {fmtProjected(b)} proj.</span>
          )}
          <span className="text-xs text-gray-600">/ {fmtTarget(b)}</span>
        </div>
      </div>
      <div className="relative h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#ffffff0d' }}>
        {/* Projected extent (faint) */}
        {showProjected && projectedPct > fillPct && (
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${projectedPct * 100}%`, backgroundColor: `${tierColor}33` }}
          />
        )}
        {/* Current fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{ width: `${fillPct * 100}%`, backgroundColor: tierColor }}
        />
      </div>
    </div>
  );
}

export default function HallOfFameMeter({
  data,
  cardBackground,
}: {
  data: HofResult;
  cardBackground: string;
}) {
  const fillLen = (data.probability / 100) * TRACK;

  return (
    <div
      className="rounded-2xl p-4 border border-white/10"
      style={{ backgroundColor: cardBackground }}
    >
      {/* Header */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Hall of Fame Outlook
      </p>

      {/* Gauge + tier block */}
      <div className="flex items-center gap-4 mb-5">
        {/* SVG Arc Gauge */}
        <div className="flex-shrink-0">
          <svg viewBox="0 0 164 140" width={140} height={120}>
            {/* Track ring (270° arc, gap at bottom) */}
            <circle
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke="#ffffff0d"
              strokeWidth={11}
              strokeDasharray={`${TRACK} ${GAP}`}
              strokeLinecap="round"
              transform={`rotate(135 ${CX} ${CY})`}
            />
            {/* Filled portion */}
            <circle
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={data.tierColor}
              strokeWidth={11}
              strokeDasharray={`${fillLen} ${CIRC - fillLen}`}
              strokeLinecap="round"
              transform={`rotate(135 ${CX} ${CY})`}
              style={{ filter: `drop-shadow(0 0 6px ${data.tierColor}88)` }}
            />
            {/* Probability number — use tier color so it reads on any card bg */}
            <text
              x={CX} y={CY - 4}
              textAnchor="middle"
              fill={data.tierColor}
              fontSize={28}
              fontWeight="900"
              fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
            >
              {data.probability}%
            </text>
            {/* Label below number */}
            <text
              x={CX} y={CY + 15}
              textAnchor="middle"
              fill="#9ca3af"
              fontSize={9}
              fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
            >
              HOF PROBABILITY
            </text>
          </svg>
        </div>

        {/* Tier + description */}
        <div className="flex-1 min-w-0">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-2"
            style={{ backgroundColor: `${data.tierColor}22`, border: `1px solid ${data.tierColor}44` }}
          >
            <span className="text-xs" aria-hidden>🏆</span>
            <span className="text-xs font-bold" style={{ color: data.tierColor }}>
              {data.tier}
            </span>
          </div>
          <p className="text-gray-400 text-xs leading-relaxed">{data.description}</p>
          {data.yearsRemaining > 0 && (
            <p className="text-gray-600 text-xs mt-1.5">
              ~{data.yearsRemaining}yr{data.yearsRemaining !== 1 ? 's' : ''} of career projected
            </p>
          )}
        </div>
      </div>

      {/* Benchmark bars */}
      <div
        className="rounded-xl p-3"
        style={{ backgroundColor: '#ffffff06' }}
      >
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          {data.isPitcher ? 'Pitching Benchmarks' : 'Hitting Benchmarks'}
        </p>
        {data.benchmarks.map(b => (
          <BenchmarkBar key={b.label} b={b} tierColor={data.tierColor} />
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-gray-700 text-xs mt-3 text-center">
        Model based on career pace, age trajectory & HOF historical standards
      </p>
    </div>
  );
}
