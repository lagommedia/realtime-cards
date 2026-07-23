'use client';

import { Pitch } from '@/lib/dummy-game-chc-stl';

export const PITCH_TYPE_COLORS: Record<string, string> = {
  FF: '#f97316', FA: '#f97316',
  FT: '#fb923c', SI: '#fb923c',
  FC: '#ef4444',
  SL: '#a855f7', ST: '#a855f7',
  SV: '#8b5cf6',
  CU: '#3b82f6', CS: '#3b82f6',
  KC: '#60a5fa',
  CH: '#22c55e',
  FS: '#14b8a6', FO: '#14b8a6',
  KN: '#eab308',
  EP: '#ec4899',
};

function pitchColor(pitchType?: string): string {
  return PITCH_TYPE_COLORS[pitchType ?? ''] ?? '#9ca3af';
}

const MODES = {
  full: {
    vb: '0 0 280 240',
    F:  { x: 20,  y: 15,  w: 240, h: 195 },
    Z:  { x: 85,  y: 45,  w: 110, h: 121 },
    r: 12, fs: 9, sw: 1.8, glowR: 17, glowSd: 3,
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
    r: 7, fs: 7, sw: 1, glowR: 11, glowSd: 2,
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
  const { F, Z, r, fs, sw, glowR, glowSd, horizonY, grassPts, dirtPts, backdropY, backdropH, mound, rubber, plate } = m;
  const mostRecent = pitches[pitches.length - 1];
  const filterId = compact ? 'sz-glow-c' : 'sz-glow-f';
  const pfx = compact ? 'c' : 'f';

  function svgX(x: number) { return F.x + (1 - x) * F.w; }
  function svgY(y: number) { return F.y + (1 - y) * F.h; }

  const platePts = [
    `${plate.cx - plate.halfW},${plate.topY}`,
    `${plate.cx + plate.halfW},${plate.topY}`,
    `${plate.cx + plate.halfW},${plate.midY}`,
    `${plate.cx},${plate.botY}`,
    `${plate.cx - plate.halfW},${plate.midY}`,
  ].join(' ');

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

          {/* Sky gradient */}
          <linearGradient id={`sky-${pfx}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#0b1d3a" />
            <stop offset="100%" stopColor="#1e4a8a" />
          </linearGradient>
          {/* Outfield grass */}
          <linearGradient id={`grass-${pfx}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#14451a" />
            <stop offset="100%" stopColor="#1f6627" />
          </linearGradient>
          {/* Infield dirt */}
          <linearGradient id={`dirt-${pfx}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#4a2a0e" />
            <stop offset="100%" stopColor="#6b3d18" />
          </linearGradient>
          {/* Pitcher's mound */}
          <radialGradient id={`mound-${pfx}`} cx="50%" cy="30%" r="60%">
            <stop offset="0%"   stopColor="#7a4a22" />
            <stop offset="100%" stopColor="#4a2a0e" />
          </radialGradient>

          {/* Clip to rounded frame */}
          <clipPath id={`clip-${pfx}`}>
            <rect x={F.x} y={F.y} width={F.w} height={F.h} rx={compact ? 5 : 9} />
          </clipPath>
        </defs>

        {/* ── Batter's-eye-view background (clipped to frame) ── */}
        <g clipPath={`url(#clip-${pfx})`}>
          {/* Sky */}
          <rect x={F.x} y={F.y} width={F.w} height={F.h} fill={`url(#sky-${pfx})`} />

          {/* Batter's eye — dark center-field backdrop directly behind pitcher */}
          <rect
            x={F.x} y={backdropY}
            width={F.w} height={backdropH}
            fill="#060f06"
          />

          {/* Outfield wall cap — thin bright line at top of grass */}
          <rect
            x={F.x} y={horizonY - (compact ? 1 : 2)}
            width={F.w} height={compact ? 2 : 4}
            fill="#1a3320"
          />

          {/* Outfield grass — perspective trapezoid */}
          <polygon points={grassPts} fill={`url(#grass-${pfx})`} />

          {/* Subtle grass texture lines (depth cues) */}
          {[0.25, 0.5, 0.75].map(t => {
            const y = horizonY + t * (F.y + F.h - horizonY);
            const xL = F.x + t * ((F.x) - F.x);
            const xR = F.x + F.w - t * 0;
            return (
              <line key={t}
                x1={xL} y1={y} x2={xR} y2={y}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={compact ? 0.5 : 1}
              />
            );
          })}

          {/* Infield dirt — perspective trapezoid */}
          <polygon points={dirtPts} fill={`url(#dirt-${pfx})`} />

          {/* Pitcher's mound */}
          <ellipse
            cx={mound.cx} cy={mound.cy}
            rx={mound.rx} ry={mound.ry}
            fill={`url(#mound-${pfx})`}
          />
          {/* Mound highlight rim */}
          <ellipse
            cx={mound.cx} cy={mound.cy - (compact ? 1.5 : 2)}
            rx={mound.rx * 0.7} ry={mound.ry * 0.45}
            fill="rgba(255,255,255,0.06)"
          />

          {/* Pitcher's rubber */}
          <rect
            x={rubber.x} y={rubber.y}
            width={rubber.w} height={rubber.h}
            fill="rgba(255,255,255,0.88)" rx={compact ? 0.5 : 1}
          />

          {/* Home plate */}
          <polygon points={platePts} fill="rgba(255,255,255,0.92)" />
          {/* Plate outline */}
          <polygon
            points={platePts}
            fill="none"
            stroke="rgba(180,180,180,0.5)"
            strokeWidth={compact ? 0.6 : 1}
          />

          {/* Basepath lines from plate to corners (subtle) */}
          {!compact && (
            <>
              <line x1={140} y1={194} x2={88}  y2={154} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
              <line x1={140} y1={194} x2={192} y2={154} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            </>
          )}
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
                stroke={color} strokeWidth={compact ? 1.2 : 1.8}
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
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `${pitchColor(type)}40`, border: `1.5px solid ${pitchColor(type)}` }} />
                <span className="text-[10px] text-slate-400">{LABEL_MAP[type] ?? type}</span>
              </div>
            ))}
            {seen.length === 0 && (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef444420', border: '1.5px solid #ef4444' }} />
                  <span className="text-[10px] text-slate-400">Strike</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e20', border: '1.5px solid #22c55e' }} />
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
