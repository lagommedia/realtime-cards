'use client';

import { useEffect, useRef, useState } from 'react';
import { PlayEventType, isPositiveEvent } from '@/lib/play-detector';

// ── Per-event projection calibration ─────────────────────────────────────────
// peak:  max % price impact (positive or negative)
// decay: fraction of peak at each horizon [NOW, 1H, 24H, 7D, 30D]
//        — shape encodes how quickly the market reacts and fades
// spread: confidence band half-width as fraction of the value at each point
//         low spread = high certainty event, high spread = noisy signal
const PROJ: Record<PlayEventType, { peak: number; decay: number[]; spread: number }> = {
  // T1 — legendary positive
  perfect_game:         { peak: 120, decay: [0.08, 0.60, 1.00, 0.92, 0.88], spread: 0.32 },
  no_hitter:            { peak:  55, decay: [0.08, 0.62, 1.00, 0.82, 0.62], spread: 0.28 },
  cycle:                { peak:  28, decay: [0.15, 0.80, 1.00, 0.66, 0.38], spread: 0.26 },
  walk_off_hr:          { peak:  22, decay: [0.28, 0.88, 1.00, 0.55, 0.28], spread: 0.24 },
  world_series_win:     { peak:  90, decay: [0.06, 0.25, 0.65, 1.00, 1.00], spread: 0.18 },
  mvp_award:            { peak:  85, decay: [0.04, 0.32, 0.72, 1.00, 1.00], spread: 0.18 },
  cy_young_award:       { peak:  40, decay: [0.04, 0.32, 0.75, 1.00, 1.00], spread: 0.20 },
  hr_milestone_50:      { peak:  55, decay: [0.14, 0.62, 1.00, 0.90, 0.82], spread: 0.26 },
  // T1 — legendary negative
  season_ending_injury: { peak: -45, decay: [0.72, 1.00, 0.88, 0.72, 0.60], spread: 0.28 },
  // T2 — major positive
  grand_slam:           { peak:  15, decay: [0.38, 0.94, 1.00, 0.55, 0.28], spread: 0.20 },
  home_run:             { peak:  10, decay: [0.48, 0.94, 1.00, 0.50, 0.22], spread: 0.22 },
  multi_hr_game:        { peak:  18, decay: [0.28, 0.90, 1.00, 0.60, 0.30], spread: 0.22 },
  five_rbi_game:        { peak:  14, decay: [0.38, 1.00, 0.85, 0.45, 0.20], spread: 0.22 },
  inside_park_hr:       { peak:  12, decay: [0.58, 1.00, 0.70, 0.38, 0.15], spread: 0.28 },
  pitcher_k_15plus:     { peak:  25, decay: [0.28, 1.00, 0.80, 0.50, 0.30], spread: 0.24 },
  cg_shutout:           { peak:  18, decay: [0.18, 0.82, 1.00, 0.70, 0.40], spread: 0.24 },
  rookie_of_year:       { peak:  50, decay: [0.06, 0.42, 0.82, 1.00, 0.90], spread: 0.24 },
  // T2 — major negative
  il_60_day:            { peak: -22, decay: [0.68, 1.00, 0.85, 0.58, 0.35], spread: 0.24 },
  suspension:           { peak: -35, decay: [0.48, 1.00, 0.95, 0.86, 0.80], spread: 0.26 },
  // T3 — notable positive
  triple:               { peak:   5, decay: [0.48, 1.00, 0.78, 0.38, 0.15], spread: 0.38 },
  stolen_base:          { peak:   2, decay: [0.48, 1.00, 0.68, 0.28, 0.10], spread: 0.42 },
  // T3 — notable negative
  double_play:          { peak:  -5, decay: [0.68, 1.00, 0.72, 0.38, 0.15], spread: 0.38 },
  il_15_day:            { peak: -12, decay: [0.58, 1.00, 0.72, 0.42, 0.20], spread: 0.26 },
  dfa:                  { peak: -18, decay: [0.58, 1.00, 0.82, 0.62, 0.38], spread: 0.26 },
  // T4 — minor
  double:               { peak:   3, decay: [0.38, 1.00, 0.58, 0.22, 0.08], spread: 0.45 },
  single:               { peak:   2, decay: [0.30, 1.00, 0.48, 0.18, 0.07], spread: 0.48 },
  strikeout:            { peak:  -3, decay: [0.58, 1.00, 0.62, 0.28, 0.10], spread: 0.42 },
  groundout:            { peak: -1.5, decay: [0.48, 1.00, 0.52, 0.22, 0.08], spread: 0.48 },
  flyout:               { peak: -1.5, decay: [0.48, 1.00, 0.52, 0.22, 0.08], spread: 0.48 },
};

const X_LABELS = ['NOW', '1H', '24H', '7D', '30D'];

// Smooth cubic bezier through points — horizontal tangents at each knot
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cpx = (x0 + x1) / 2;
    d += ` C ${cpx.toFixed(2)} ${y0.toFixed(2)}, ${cpx.toFixed(2)} ${y1.toFixed(2)}, ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  return d;
}

// Build closed confidence band polygon (upper forward, lower reversed)
function bandPath(up: [number, number][], lo: [number, number][]): string {
  const upper = smoothPath(up);
  const loRev = [...lo].reverse();
  const loSeg = loRev.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ');
  return `${upper} L ${loSeg} Z`;
}

interface Props {
  eventType: PlayEventType;
  color: string;
}

export default function EventProjectionChart({ eventType, color }: Props) {
  const [clipW, setClipW] = useState(0); // animated clip width (px in viewBox units)
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  // Eased draw-on animation: left → right over 1.6s
  const CHART_W = 262; // px in viewBox
  const ANIM_MS = 1600;

  useEffect(() => {
    setClipW(0);
    startRef.current = null;
    const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const t = Math.min((now - startRef.current) / ANIM_MS, 1);
      setClipW(ease(t) * CHART_W);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [eventType]);

  const proj = PROJ[eventType] ?? { peak: 8, decay: [0.3, 0.9, 1, 0.6, 0.3], spread: 0.3 };
  const positive = isPositiveEvent(eventType);

  // Raw % values at each horizon
  const values: number[] = proj.decay.map(d => proj.peak * d);

  // SVG layout constants
  const VW = 320, VH = 158;
  const PAD = { l: 44, r: 14, t: 18, b: 30 };
  const chartW = VW - PAD.l - PAD.r; // 262
  const chartH = VH - PAD.t - PAD.b; // 110

  // Y scale: auto-fit all values + band + 0 with 8% headroom
  const bandVals = values.flatMap(v => [v * (1 + proj.spread), v * (1 - proj.spread)]);
  const allY = [0, ...values, ...bandVals];
  const rawMin = Math.min(...allY);
  const rawMax = Math.max(...allY);
  const yPad = (rawMax - rawMin) * 0.08 || 1;
  const yMin = rawMin - yPad;
  const yMax = rawMax + yPad;
  const yRange = yMax - yMin;

  const toY = (v: number) => PAD.t + chartH - ((v - yMin) / yRange) * chartH;
  const toX = (i: number) => PAD.l + (i / (values.length - 1)) * chartW;

  // Coordinate arrays
  const midPts: [number, number][] = values.map((v, i) => [toX(i), toY(v)]);
  const upPts:  [number, number][] = values.map((v, i) => [toX(i), toY(v * (1 + proj.spread))]);
  const loPts:  [number, number][] = values.map((v, i) => [toX(i), toY(v * (1 - proj.spread))]);
  const baselineY = toY(0);

  // SVG paths
  const linePath  = smoothPath(midPts);
  const upPath    = smoothPath(upPts);
  const loPath    = smoothPath(loPts);
  const bandFill  = bandPath(upPts, loPts);

  // Animated cursor: interpolate position along the main line
  const clipProgress = Math.min(clipW / chartW, 1);
  const cursorIdx = clipProgress * (values.length - 1);
  const ci0 = Math.min(Math.floor(cursorIdx), values.length - 2);
  const ci1 = ci0 + 1;
  const frac = cursorIdx - ci0;
  const cursorX = midPts[ci0][0] + frac * (midPts[ci1][0] - midPts[ci0][0]);
  const cursorY = midPts[ci0][1] + frac * (midPts[ci1][1] - midPts[ci0][1]);
  const cursorVal = values[ci0] + frac * (values[ci1] - values[ci0]);

  // Y-axis reference lines: 0, peak, midpoint between peak and 0
  const yRefs: { v: number; label: string; dashed: boolean }[] = [];
  yRefs.push({ v: 0, label: '0%', dashed: true });
  if (Math.abs(proj.peak) >= 5) {
    yRefs.push({
      v: proj.peak,
      label: `${proj.peak > 0 ? '+' : ''}${proj.peak}%`,
      dashed: false,
    });
  }
  // mid-reference if peak is large enough
  if (Math.abs(proj.peak) >= 20) {
    const mid = proj.peak / 2;
    yRefs.push({
      v: mid,
      label: `${mid > 0 ? '+' : ''}${Math.round(mid)}%`,
      dashed: false,
    });
  }

  const uid = eventType.replace(/_/g, '-');
  const sign = (v: number) => v > 0 ? '+' : '';
  const h24 = values[2];
  const h7d = values[3];

  return (
    <div className="w-full select-none">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>
          Card Value Projection
        </span>
        <span className="text-[9px] text-gray-600 uppercase tracking-wider">
          5 horizons · ±{Math.round(proj.spread * 100)}% band
        </span>
      </div>

      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible' }}
        aria-hidden
      >
        <defs>
          {/* Clip rect that expands left→right for the draw-on effect */}
          <clipPath id={`clip-${uid}`}>
            <rect x={PAD.l} y={0} width={clipW} height={VH} />
          </clipPath>

          {/* Glow filter on main line */}
          <filter id={`glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Band fill gradient — vertical, fades toward 0% line */}
          <linearGradient
            id={`band-fill-${uid}`}
            x1="0" y1={positive ? '0%' : '100%'}
            x2="0" y2={positive ? '100%' : '0%'}
          >
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>

          {/* Area fill under/over main line toward baseline */}
          <linearGradient
            id={`area-fill-${uid}`}
            x1="0" y1={positive ? '0%' : '100%'}
            x2="0" y2={positive ? '100%' : '0%'}
          >
            <stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0.00} />
          </linearGradient>
        </defs>

        {/* ── Y-axis reference lines & labels ───────────────────────────────── */}
        {yRefs.map(({ v, label, dashed }) => {
          const y = toY(v);
          const isZero = v === 0;
          return (
            <g key={v}>
              <line
                x1={PAD.l} y1={y} x2={VW - PAD.r} y2={y}
                stroke={isZero ? '#ffffff20' : `${color}28`}
                strokeWidth={isZero ? 1 : 0.6}
                strokeDasharray={dashed ? '3 4' : '1.5 4'}
              />
              <text
                x={PAD.l - 5} y={y + 3.5}
                textAnchor="end" fontSize={8}
                fill={isZero ? '#4b5563' : `${color}99`}
                fontWeight={isZero ? '400' : '700'}
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* ── Vertical tick lines at each horizon ───────────────────────────── */}
        {values.map((_, i) => (
          <line
            key={i}
            x1={toX(i)} y1={PAD.t}
            x2={toX(i)} y2={VH - PAD.b}
            stroke="#ffffff08" strokeWidth={0.8}
          />
        ))}

        {/* ── Confidence band fill (clipped) ────────────────────────────────── */}
        <path
          d={bandFill}
          fill={`url(#band-fill-${uid})`}
          clipPath={`url(#clip-${uid})`}
        />

        {/* ── Confidence band boundary dashes (clipped) ─────────────────────── */}
        <path
          d={upPath} fill="none"
          stroke={color} strokeWidth={0.8}
          strokeOpacity={0.28} strokeDasharray="2.5 3.5"
          clipPath={`url(#clip-${uid})`}
        />
        <path
          d={loPath} fill="none"
          stroke={color} strokeWidth={0.8}
          strokeOpacity={0.28} strokeDasharray="2.5 3.5"
          clipPath={`url(#clip-${uid})`}
        />

        {/* ── Area fill between line and baseline (clipped) ─────────────────── */}
        {(() => {
          // Build a closed path: line → vertical to baseline → horizontal back → close
          const areaPath = `${linePath} L ${midPts[midPts.length - 1][0].toFixed(2)} ${baselineY.toFixed(2)} L ${PAD.l.toFixed(2)} ${baselineY.toFixed(2)} Z`;
          return (
            <path
              d={areaPath}
              fill={`url(#area-fill-${uid})`}
              clipPath={`url(#clip-${uid})`}
            />
          );
        })()}

        {/* ── Main projection line (clipped, glowing) ───────────────────────── */}
        <path
          d={linePath} fill="none"
          stroke={color} strokeWidth={2.2}
          strokeLinecap="round" strokeLinejoin="round"
          filter={`url(#glow-${uid})`}
          clipPath={`url(#clip-${uid})`}
        />

        {/* ── Horizon dots — pop in as clip passes them ─────────────────────── */}
        {midPts.map(([x, y], i) => {
          const dotX = x - PAD.l;           // relative to chart left
          const visible = clipW >= dotX - 2; // show once clip reaches this dot
          if (!visible) return null;
          const isFirst = i === 0;
          return (
            <g key={i}>
              {/* Outer ring */}
              <circle cx={x} cy={y} r={5.5}
                fill="none" stroke={color} strokeWidth={1}
                strokeOpacity={0.3}
              />
              {/* Filled dot */}
              <circle cx={x} cy={y} r={3}
                fill={isFirst ? '#0f172a' : color}
                stroke={color} strokeWidth={isFirst ? 2 : 0}
              />
            </g>
          );
        })}

        {/* ── Animated cursor dot at leading edge ───────────────────────────── */}
        {clipProgress < 0.98 && (
          <g>
            <circle cx={cursorX} cy={cursorY} r={6}
              fill={color} fillOpacity={0.20}
            />
            <circle cx={cursorX} cy={cursorY} r={3.5}
              fill={color}
            />
            {/* Floating value tag */}
            {(() => {
              const tagW = 42, tagH = 16, tagR = 4;
              const tagX = Math.min(cursorX - tagW / 2, VW - PAD.r - tagW);
              const tagY = cursorY - tagH - 6;
              return (
                <g>
                  <rect x={tagX} y={tagY} width={tagW} height={tagH}
                    rx={tagR} fill={color} fillOpacity={0.92}
                  />
                  <text
                    x={tagX + tagW / 2} y={tagY + tagH - 5}
                    textAnchor="middle" fontSize={8.5}
                    fontWeight="800" fill="#000"
                  >
                    {sign(cursorVal)}{cursorVal.toFixed(1)}%
                  </text>
                </g>
              );
            })()}
          </g>
        )}

        {/* ── X-axis labels ─────────────────────────────────────────────────── */}
        {X_LABELS.map((lbl, i) => (
          <text
            key={i}
            x={toX(i)} y={VH - 10}
            textAnchor="middle"
            fontSize={8} fontWeight="600"
            fill={i === 0 ? '#6b7280' : '#374151'}
          >
            {lbl}
          </text>
        ))}
        {/* Thin x-axis baseline */}
        <line
          x1={PAD.l} y1={VH - PAD.b}
          x2={VW - PAD.r} y2={VH - PAD.b}
          stroke="#1f2937" strokeWidth={1}
        />
      </svg>

      {/* ── Horizon summary row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 mt-1 px-0.5">
        {[
          { label: '24H', val: h24 },
          { label: '7D',  val: h7d },
          { label: '30D', val: values[4] },
        ].map(({ label, val }) => (
          <div
            key={label}
            className="rounded-xl py-2 text-center"
            style={{ backgroundColor: `${color}10`, border: `1px solid ${color}22` }}
          >
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
            <p className="font-black text-sm leading-none" style={{ color }}>
              {sign(val)}{val.toFixed(1)}%
            </p>
            <p className="text-[8px] text-gray-600 mt-0.5 uppercase tracking-wider">
              {Math.abs(val * proj.spread).toFixed(1)}% var
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
