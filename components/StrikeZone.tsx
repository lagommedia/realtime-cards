'use client';

import { Pitch } from '@/lib/dummy-game-chc-stl';

export const PITCH_TYPE_COLORS: Record<string, string> = {
  FF: '#991b1b', FA: '#991b1b',  // deep crimson — four-seam fastball
  FT: '#9a3412', SI: '#9a3412',  // burnt orange — two-seam / sinker
  FC: '#92400e',                  // dark amber — cutter
  SL: '#5b21b6', ST: '#5b21b6',  // deep violet — slider / sweeper
  SV: '#6b21a8',                  // deep purple — slurve
  CU: '#1e40af', CS: '#1e40af',  // navy blue — curveball
  KC: '#075985',                  // deep sky — knuckle-curve
  CH: '#166534',                  // forest green — changeup
  FS: '#115e59', FO: '#115e59',  // deep teal — splitter / forkball
  KN: '#854d0e',                  // dark gold — knuckleball
  EP: '#9d174d',                  // deep rose — eephus
};

function pitchColor(pitchType?: string): string {
  return PITCH_TYPE_COLORS[pitchType ?? ''] ?? '#9ca3af';
}

const MODES = {
  full: {
    vb: '0 0 280 240',
    F:  { x: 20,  y: 15,  w: 240, h: 195 },
    Z:  { x: 85,  y: 45,  w: 110, h: 121 },
    r: 6, fs: 7, sw: 1.8, glowR: 9, glowSd: 3,
    horizonY:   36,
    grassPts:  '100,36 180,36 260,210 20,210',
    dirtPts:   '38,140 242,140 260,210 20,210',
    backdropY:  22, backdropH: 24,
    mound:  { cx: 140, cy: 64, rx: 28, ry: 9 },
    rubber: { x:  128, y:  60, w: 24, h: 6 },
    plate:  { cx: 140, topY: 194, midY: 202, botY: 210, halfW: 15 },
  },
  compact: {
    vb: '0 0 120 144',
    F:  { x: 2,  y: 2,  w: 116, h: 140 },
    Z:  { x: 36, y: 26, w: 48,  h:  84 },
    r: 4, fs: 5, sw: 1, glowR: 6, glowSd: 2,
    horizonY:   20,
    grassPts:  '40,20 80,20 118,142 2,142',
    dirtPts:   '10,86 110,86 118,142 2,142',
    backdropY:  12, backdropH: 14,
    mound:  { cx: 60, cy: 38, rx: 13, ry: 5 },
    rubber: { x: 54,  y: 35, w: 12, h: 3 },
    plate:  { cx: 60, topY: 132, midY: 138, botY: 142, halfW: 8 },
  },
};

export default function StrikeZone({ pitches, compact = false }: { pitches: Pitch[]; compact?: boolean }) {
  const m = compact ? MODES.compact : MODES.full;
  const { F, Z, r, fs, sw, glowR, glowSd } = m;
  const mostRecent = pitches[pitches.length - 1];
  const filterId = compact ? 'sz-glow-c' : 'sz-glow-f';
  const pfx = compact ? 'c' : 'f';

  function svgX(x: number) { return F.x + x * F.w; }
  function svgY(y: number) { return F.y + (1 - y) * F.h; }

  return (
    <div className="flex flex-col w-full h-full">
      <style>{`
        @keyframes pitch-flash {
          0%   { opacity: 0.05; }
          18%  { opacity: 1; }
          36%  { opacity: 0.05; }
          54%  { opacity: 1; }
          72%  { opacity: 0.05; }
          100% { opacity: 1; }
        }
        .pitch-flash { animation: pitch-flash 1.8s ease-out forwards; }
      `}</style>
      {!compact && (
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          Pitch Locations · At Bat
        </p>
      )}

      <svg viewBox={m.vb} width="100%" height="100%" preserveAspectRatio="xMidYMin meet" style={{ display: 'block', flex: 1 }}>
        <defs>
          <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation={glowSd} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Blur filter for glass morphism zone */}
          <filter id={`zone-blur-${pfx}`} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation={compact ? 4 : 7} />
          </filter>

          {/* Clip to rounded frame */}
          <clipPath id={`clip-${pfx}`}>
            <rect x={F.x} y={F.y} width={F.w} height={F.h} rx={compact ? 5 : 9} />
          </clipPath>

          {/* Clip to strike zone rectangle */}
          <clipPath id={`zone-clip-${pfx}`}>
            <rect x={Z.x} y={Z.y} width={Z.w} height={Z.h} />
          </clipPath>
        </defs>

        {/* ── Stadium photo background (clipped to frame) ── */}
        <g clipPath={`url(#clip-${pfx})`}>
          <image
            href="/stadium-bg.jpg"
            x={F.x} y={F.y}
            width={F.w} height={F.h}
            preserveAspectRatio="xMidYMid slice"
          />
          {/* Brightness overlay — washes out image so pitch dots and text stay legible */}
          <rect x={F.x} y={F.y} width={F.w} height={F.h} fill="rgba(255,255,255,0.58)" />
        </g>

        {/* ── Glass morphism: blurred photo + frost tint behind zone only ── */}
        <g clipPath={`url(#clip-${pfx})`}>
          <g clipPath={`url(#zone-clip-${pfx})`}>
            <image
              href="/stadium-bg.jpg"
              x={F.x} y={F.y}
              width={F.w} height={F.h}
              preserveAspectRatio="xMidYMid slice"
              filter={`url(#zone-blur-${pfx})`}
            />
            {/* Frosted glass tint — brighter than the background overlay */}
            <rect x={Z.x} y={Z.y} width={Z.w} height={Z.h} fill="rgba(255,255,255,0.72)" />
          </g>
        </g>

        {/* ── Frame border (dashed, on top of background) ── */}
        <rect x={F.x} y={F.y} width={F.w} height={F.h}
          fill="none"
          stroke="rgba(148,163,184,0.35)"
          strokeWidth={sw * 0.6}
          strokeDasharray={compact ? '4 3' : '6 4'}
          rx={compact ? 5 : 9}
        />

        {/* ── Strike zone (semi-transparent over field) ── */}
        <rect x={Z.x} y={Z.y} width={Z.w} height={Z.h}
          fill="rgba(255,255,255,0.06)"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth={sw}
        />

        {/* 3×3 grid */}
        {[1, 2].map(i => (
          <line key={`zv-${i}`}
            x1={Z.x + Z.w * (i / 3)} y1={Z.y}
            x2={Z.x + Z.w * (i / 3)} y2={Z.y + Z.h}
            stroke="rgba(255,255,255,0.20)" strokeWidth={compact ? 0.5 : 0.8}
          />
        ))}
        {[1, 2].map(i => (
          <line key={`zh-${i}`}
            x1={Z.x} y1={Z.y + Z.h * (i / 3)}
            x2={Z.x + Z.w} y2={Z.y + Z.h * (i / 3)}
            stroke="rgba(255,255,255,0.20)" strokeWidth={compact ? 0.5 : 0.8}
          />
        ))}

        {/* HI / LO labels (full mode only) */}
        {!compact && (
          <>
            <text x={Z.x + 4} y={Z.y + 11} fontSize={7.5} fill="rgba(255,255,255,0.4)" fontFamily="monospace">HI</text>
            <text x={Z.x + 4} y={Z.y + Z.h - 4} fontSize={7.5} fill="rgba(255,255,255,0.4)" fontFamily="monospace">LO</text>
          </>
        )}

        {/* ── Pitch dots ── */}
        {pitches.map(pitch => {
          const cx = svgX(pitch.x);
          const cy = svgY(pitch.y);
          const color = pitchColor(pitch.pitchType);
          const isLatest = pitch.seq === mostRecent?.seq;
          const isBall = pitch.result === 'ball';
          const fillOpacity = isBall ? '25' : pitch.result === 'foul' ? '35' : '50';
          const dash = isBall ? (compact ? '3 2' : '4 3') : undefined;
          const speed = !compact && pitch.velocity ? Math.round(pitch.velocity) : null;

          return (
            <g key={pitch.seq} filter={`url(#${filterId})`}>
              {isLatest && (
                <circle cx={cx} cy={cy} r={glowR}
                  fill="none" stroke={color}
                  strokeWidth={compact ? 0.7 : 1}
                  strokeDasharray={dash}
                  className="pitch-flash"
                />
              )}
              <circle cx={cx} cy={cy} r={r}
                fill={`${color}${fillOpacity}`}
                stroke={color} strokeWidth={compact ? 0.7 : 1}
                strokeDasharray={dash}
                className={isLatest ? 'pitch-flash' : undefined}
              />
              <text x={cx} y={speed ? cy - 2 : cy}
                textAnchor="middle" dominantBaseline="central"
                fontSize={fs} fontWeight="800" fill={color} fontFamily="monospace"
                className={isLatest ? 'pitch-flash' : undefined}
              >
                {pitch.seq}
              </text>
              {speed && (
                <text x={cx} y={cy + fs}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={fs - 2} fill={color} fontFamily="monospace" opacity="0.85"
                >
                  {speed}
                </text>
              )}
            </g>
          );
        })}

        {/* MPH readout */}
        {mostRecent?.velocity && (
          <text
            x={F.x + F.w - 4}
            y={F.y + F.h - (compact ? 4 : 6)}
            textAnchor="end"
            dominantBaseline="auto"
            fontSize={compact ? 7 : 9}
            fontWeight="900"
            fill="rgba(255,255,255,0.85)"
            fontFamily="monospace"
            className="pitch-flash"
          >
            {Math.round(mostRecent.velocity)} MPH
          </text>
        )}
      </svg>

      {/* Pitch type legend — full mode only */}
      {!compact && (() => {
        const seen = [...new Set(pitches.map(p => p.pitchType).filter(Boolean))] as string[];
        const LABEL_MAP: Record<string, string> = {
          FF:'Fastball',FA:'Fastball',FT:'2-Seam',SI:'Sinker',FC:'Cutter',
          SL:'Slider',ST:'Sweeper',SV:'Slurve',CU:'Curve',CS:'Curve',KC:'Knuckle-C',
          CH:'Changeup',FS:'Splitter',FO:'Forkball',KN:'Knuckleball',EP:'Eephus',
        };
        return (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {seen.map(type => (
              <div key={type} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `${pitchColor(type)}30`, border: `1px solid ${pitchColor(type)}` }} />
                <span className="text-[10px] text-slate-400">{LABEL_MAP[type] ?? type}</span>
              </div>
            ))}
            {seen.length === 0 && (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#991b1b20', border: '1px solid #991b1b' }} />
                  <span className="text-[10px] text-slate-400">Strike / Foul</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#16653420', border: '1px solid #166534', borderStyle: 'dashed' }} />
                  <span className="text-[10px] text-slate-400">Ball</span>
                </div>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
