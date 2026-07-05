'use client';

import { Pitch } from '@/lib/dummy-game-chc-stl';

function dotColor(result: Pitch['result']) {
  return result === 'ball' ? '#22c55e' : '#ef4444'; // ball=green; called/swinging strike + foul=red
}

// Two layout modes — full (standalone) and compact (3-column inset)
const MODES = {
  full: {
    vb: '0 0 280 240',
    F:  { x: 20,  y: 15,  w: 240, h: 195 },
    Z:  { x: 85,  y: 45,  w: 110, h: 121 },
    r: 12, fs: 9, sw: 1.8, plateW: 13, glowR: 17, glowSd: 3,
  },
  compact: {
    vb: '0 0 120 185',
    F:  { x: 8,   y: 10,  w: 104, h: 140 },
    Z:  { x: 36,  y: 34,  w: 48,  h: 84  },
    r: 7, fs: 7, sw: 1, plateW: 8, glowR: 11, glowSd: 2,
  },
};

export default function StrikeZone({ pitches, compact = false }: { pitches: Pitch[]; compact?: boolean }) {
  const m = compact ? MODES.compact : MODES.full;
  const { F, Z, r, fs, sw, plateW, glowR, glowSd } = m;
  const cx0 = F.x + F.w / 2;
  const mostRecent = pitches[pitches.length - 1];
  const filterId = compact ? 'sz-glow-c' : 'sz-glow-f';
  const gradId   = compact ? 'sz-bg-c'   : 'sz-bg-f';

  function svgX(x: number) { return F.x + x * F.w; }
  function svgY(y: number) { return F.y + (1 - y) * F.h; }

  return (
    <div className="flex flex-col h-full">
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
        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">
          Pitch Locations · At Bat
        </p>
      )}

      <svg viewBox={m.vb} width="100%" style={{ display: 'block', flex: 1 }}>
        <defs>
          <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation={glowSd} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={gradId} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#0f1929" />
            <stop offset="100%" stopColor="#07111e" />
          </radialGradient>
        </defs>

        {/* Outer frame */}
        <rect x={F.x} y={F.y} width={F.w} height={F.h}
          fill={`url(#${gradId})`} stroke="#1e293b"
          strokeWidth={sw * 0.6} strokeDasharray={compact ? '4 3' : '6 4'} rx={compact ? 4 : 8}
        />

        {/* Strike zone fill */}
        <rect x={Z.x} y={Z.y} width={Z.w} height={Z.h}
          fill="#0b1424" stroke="#334155" strokeWidth={sw}
        />

        {/* 3×3 grid */}
        {[1, 2].map(i => (
          <line key={`zv-${i}`}
            x1={Z.x + Z.w * (i / 3)} y1={Z.y}
            x2={Z.x + Z.w * (i / 3)} y2={Z.y + Z.h}
            stroke="#1e293b" strokeWidth={compact ? 0.5 : 1}
          />
        ))}
        {[1, 2].map(i => (
          <line key={`zh-${i}`}
            x1={Z.x} y1={Z.y + Z.h * (i / 3)}
            x2={Z.x + Z.w} y2={Z.y + Z.h * (i / 3)}
            stroke="#1e293b" strokeWidth={compact ? 0.5 : 1}
          />
        ))}

        {/* HI / LO zone labels (full mode only) */}
        {!compact && (
          <>
            <text x={Z.x + 4} y={Z.y + 11} fontSize={7.5} fill="#374151" fontFamily="monospace">HI</text>
            <text x={Z.x + 4} y={Z.y + Z.h - 4} fontSize={7.5} fill="#374151" fontFamily="monospace">LO</text>
          </>
        )}

        {/* Pitch dots */}
        {pitches.map(pitch => {
          const cx = svgX(pitch.x);
          const cy = svgY(pitch.y);
          const color = dotColor(pitch.result);
          const isLatest = pitch.seq === mostRecent?.seq;

          return (
            <g key={pitch.seq} filter={`url(#${filterId})`}>
              {isLatest && (
                <circle
                  key={`ring-${pitch.seq}`}
                  cx={cx} cy={cy} r={glowR} fill="none"
                  stroke={color} strokeWidth={compact ? 0.7 : 1}
                  className="pitch-flash"
                />
              )}
              <circle
                key={`dot-${pitch.seq}`}
                cx={cx} cy={cy} r={r}
                fill={`${color}22`} stroke={color} strokeWidth={compact ? 1.2 : 1.8}
                className={isLatest ? 'pitch-flash' : undefined}
              />
              <text x={cx} y={cy}
                textAnchor="middle" dominantBaseline="central"
                fontSize={fs} fontWeight="800" fill={color} fontFamily="monospace"
                className={isLatest ? 'pitch-flash' : undefined}
              >
                {pitch.seq}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend — full mode only */}
      {!compact && (
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef444422', border: '1.5px solid #ef4444' }} />
            <span className="text-[10px] text-gray-400">Strike</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e22', border: '1.5px solid #22c55e' }} />
            <span className="text-[10px] text-gray-400">Ball</span>
          </div>
        </div>
      )}
    </div>
  );
}
