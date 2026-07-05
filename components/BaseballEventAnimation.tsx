'use client';

import { PlayEventType } from '@/lib/play-detector';

// ── Shared baseball SVG ──────────────────────────────────────────────────────
function Baseball({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'block' }}>
      <circle cx="16" cy="16" r="15.5" fill="white" />
      {/* Left seam pair */}
      <path d="M 8 5 C 4 10 4 22 8 27" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M 8 5 C 12 10 12 22 8 27" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" />
      {/* Left stitch marks */}
      <line x1="6" y1="10" x2="10" y2="11" stroke="#dc2626" strokeWidth="1" strokeLinecap="round" />
      <line x1="5" y1="14" x2="10" y2="14" stroke="#dc2626" strokeWidth="1" strokeLinecap="round" />
      <line x1="6" y1="18" x2="10" y2="17" stroke="#dc2626" strokeWidth="1" strokeLinecap="round" />
      <line x1="6" y1="22" x2="10" y2="21" stroke="#dc2626" strokeWidth="1" strokeLinecap="round" />
      {/* Right seam pair */}
      <path d="M 24 5 C 28 10 28 22 24 27" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M 24 5 C 20 10 20 22 24 27" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" />
      {/* Right stitch marks */}
      <line x1="26" y1="10" x2="22" y2="11" stroke="#dc2626" strokeWidth="1" strokeLinecap="round" />
      <line x1="27" y1="14" x2="22" y2="14" stroke="#dc2626" strokeWidth="1" strokeLinecap="round" />
      <line x1="26" y1="18" x2="22" y2="17" stroke="#dc2626" strokeWidth="1" strokeLinecap="round" />
      <line x1="26" y1="22" x2="22" y2="21" stroke="#dc2626" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

// ── Spark burst SVG ──────────────────────────────────────────────────────────
function SparkBurst({ color = '#f59e0b' }: { color?: string }) {
  const spokes = 8;
  return (
    <svg width="52" height="52" viewBox="0 0 52 52">
      {Array.from({ length: spokes }, (_, i) => {
        const angle = (i / spokes) * Math.PI * 2 - Math.PI / 2;
        const x2 = 26 + Math.cos(angle) * 22;
        const y2 = 26 + Math.sin(angle) * 22;
        const mx = 26 + Math.cos(angle) * 10;
        const my = 26 + Math.sin(angle) * 10;
        return (
          <line key={i} x1={mx} y1={my} x2={x2} y2={y2}
            stroke={color} strokeWidth={i % 2 === 0 ? 2.5 : 1.5} strokeLinecap="round" />
        );
      })}
      <circle cx="26" cy="26" r="5" fill={color} />
    </svg>
  );
}

// ── Fence silhouette ─────────────────────────────────────────────────────────
function Fence({ color = 'rgba(255,255,255,0.18)' }: { color?: string }) {
  const posts = Array.from({ length: 10 }, (_, i) => i * 30 + 5);
  return (
    <svg width="100%" height="32" viewBox="0 0 300 32" preserveAspectRatio="none"
         style={{ display: 'block' }}>
      {/* Field surface */}
      <rect x="0" y="18" width="300" height="14" fill="rgba(34,197,94,0.12)" />
      {/* Warning track */}
      <rect x="0" y="14" width="300" height="4" fill="rgba(180,120,60,0.15)" />
      {/* Fence rail */}
      <rect x="0" y="12" width="300" height="3" fill={color} rx="1" />
      {/* Posts */}
      {posts.map(x => (
        <rect key={x} x={x} y="12" width="5" height="20" fill={color} rx="1" />
      ))}
    </svg>
  );
}

// ── Home Run animation ───────────────────────────────────────────────────────
export function HomeRunAnimation({ color = '#ef4444' }: { color?: string }) {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: 140 }}>
      <style>{`
        @keyframes hr-ball {
          0%   { transform: translate(18px, 105px) rotate(0deg);   opacity: 1; }
          25%  { transform: translate(88px,  38px) rotate(200deg); opacity: 1; }
          50%  { transform: translate(158px,  8px) rotate(400deg); opacity: 1; }
          75%  { transform: translate(220px, 30px) rotate(560deg); opacity: 1; }
          88%  { transform: translate(265px, 55px) rotate(660deg); opacity: 0.5; }
          100% { transform: translate(290px, 70px) rotate(720deg); opacity: 0; }
        }
        @keyframes hr-trail-1 {
          0%,15% { opacity: 0; }
          25%    { opacity: 0.45; }
          60%    { opacity: 0.2; }
          100%   { opacity: 0; }
        }
        @keyframes hr-trail-2 {
          0%,30% { opacity: 0; }
          45%    { opacity: 0.35; }
          75%    { opacity: 0.1; }
          100%   { opacity: 0; }
        }
        @keyframes hr-burst {
          0%   { transform: translate(158px, 8px) scale(0); opacity: 0; }
          50%  { transform: translate(152px, 2px) scale(1);   opacity: 1; }
          100% { transform: translate(148px,-2px) scale(1.6); opacity: 0; }
        }
        @keyframes hr-arc-path {
          0%   { stroke-dashoffset: 420; opacity: 0.2; }
          100% { stroke-dashoffset: 0;   opacity: 0; }
        }
        .hr-ball   { position:absolute; top:0; left:0; animation: hr-ball 2s cubic-bezier(0.3,0,0.7,1) 0.1s forwards; }
        .hr-trail-1{ position:absolute; top:0; left:0; animation: hr-trail-1 2s ease-out 0.1s forwards; }
        .hr-trail-2{ position:absolute; top:0; left:0; animation: hr-trail-2 2s ease-out 0.1s forwards; }
        .hr-burst  { position:absolute; top:0; left:0; animation: hr-burst 0.6s ease-out 1.05s forwards; }
        .hr-arc    { stroke-dasharray: 420; animation: hr-arc-path 2s ease-out 0.1s forwards; }
      `}</style>

      {/* Arc path guide (faint) */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 140" style={{ overflow: 'visible' }}>
        <path
          className="hr-arc"
          d="M 30 118 Q 158 -12 275 75"
          fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"
          strokeLinecap="round" strokeDasharray="420"
        />
      </svg>

      {/* Speed trail 1 — close ghost */}
      <div className="hr-trail-1" style={{ opacity: 0 }}>
        <svg width="22" height="22" viewBox="0 0 32 32" style={{ opacity: 0.35 }}>
          <circle cx="16" cy="16" r="15.5" fill="rgba(255,255,255,0.4)" />
        </svg>
      </div>
      {/* Speed trail 2 — far ghost */}
      <div className="hr-trail-2" style={{ opacity: 0 }}>
        <svg width="18" height="18" viewBox="0 0 32 32" style={{ opacity: 0.2 }}>
          <circle cx="16" cy="16" r="15.5" fill="rgba(255,255,255,0.25)" />
        </svg>
      </div>

      {/* Spark burst at peak */}
      <div className="hr-burst" style={{ opacity: 0 }}>
        <SparkBurst color={color} />
      </div>

      {/* The ball */}
      <div className="hr-ball" style={{ opacity: 0 }}>
        <Baseball size={30} />
      </div>

      {/* Fence at bottom */}
      <div className="absolute bottom-0 left-0 right-0">
        <Fence />
      </div>
    </div>
  );
}

// ── Grand Slam animation — same arc, 4 runners streak ────────────────────────
export function GrandSlamAnimation({ color = '#a855f7' }: { color?: string }) {
  const RUNNER_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'];
  return (
    <div className="relative w-full overflow-hidden" style={{ height: 140 }}>
      <style>{`
        @keyframes gs-ball   { 0%{transform:translate(18px,105px) rotate(0deg);opacity:1} 50%{transform:translate(158px,8px) rotate(400deg);opacity:1} 88%{transform:translate(265px,55px) rotate(660deg);opacity:0.5} 100%{transform:translate(290px,70px) rotate(720deg);opacity:0} }
        @keyframes gs-burst  { 0%{transform:translate(152px,2px) scale(0);opacity:0} 50%{transform:translate(148px,-4px) scale(1.2);opacity:1} 100%{transform:translate(144px,-8px) scale(2);opacity:0} }
        @keyframes runner-0  { 0%,10%{opacity:0;transform:translate(148px,95px)} 15%{opacity:1;transform:translate(148px,95px)} 40%{transform:translate(210px,58px);opacity:0.8} 70%{transform:translate(255px,95px);opacity:0.6} 100%{transform:translate(295px,95px);opacity:0} }
        @keyframes runner-1  { 0%,25%{opacity:0;transform:translate(148px,95px)} 30%{opacity:1;transform:translate(148px,95px)} 55%{transform:translate(210px,58px);opacity:0.8} 80%{transform:translate(255px,95px);opacity:0.6} 100%{transform:translate(295px,95px);opacity:0} }
        @keyframes runner-2  { 0%,40%{opacity:0;transform:translate(148px,95px)} 45%{opacity:1;transform:translate(148px,95px)} 70%{transform:translate(210px,58px);opacity:0.8} 90%{transform:translate(255px,95px);opacity:0.6} 100%{transform:translate(295px,95px);opacity:0} }
        @keyframes runner-3  { 0%,55%{opacity:0;transform:translate(148px,95px)} 60%{opacity:1;transform:translate(148px,95px)} 80%{transform:translate(210px,58px);opacity:0.8} 95%{transform:translate(255px,95px);opacity:0.6} 100%{transform:translate(295px,95px);opacity:0} }
        .gs-ball   { position:absolute;top:0;left:0;animation:gs-ball 2.2s cubic-bezier(0.3,0,0.7,1) 0.1s forwards }
        .gs-burst  { position:absolute;top:0;left:0;animation:gs-burst 0.7s ease-out 1.15s forwards;opacity:0 }
        .gs-r0     { position:absolute;top:0;left:0;animation:runner-0 2.2s ease-out 0.1s forwards;opacity:0 }
        .gs-r1     { position:absolute;top:0;left:0;animation:runner-1 2.2s ease-out 0.1s forwards;opacity:0 }
        .gs-r2     { position:absolute;top:0;left:0;animation:runner-2 2.2s ease-out 0.1s forwards;opacity:0 }
        .gs-r3     { position:absolute;top:0;left:0;animation:runner-3 2.2s ease-out 0.1s forwards;opacity:0 }
      `}</style>

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 140">
        <path d="M 30 118 Q 158 -12 275 75" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      <div className="gs-burst" style={{ opacity: 0 }}><SparkBurst color={color} /></div>
      <div className="gs-ball" style={{ opacity: 0 }}><Baseball size={30} /></div>

      {RUNNER_COLORS.map((rc, i) => (
        <div key={i} className={`gs-r${i}`} style={{ opacity: 0 }}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <circle cx="5" cy="5" r="4.5" fill={rc} />
          </svg>
        </div>
      ))}

      <div className="absolute bottom-0 left-0 right-0"><Fence color="rgba(167,139,250,0.3)" /></div>
    </div>
  );
}

// ── Triple animation — screaming line drive ───────────────────────────────────
export function TripleAnimation({ color = '#f97316' }: { color?: string }) {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: 120 }}>
      <style>{`
        @keyframes triple-ball { 0%{transform:translate(20px,80px) rotate(0deg);opacity:1} 100%{transform:translate(290px,42px) rotate(720deg);opacity:0} }
        @keyframes triple-smoke { 0%{transform:translate(20px,80px) scaleX(0);opacity:0} 30%{opacity:0.5;scaleX(1)} 100%{transform:translate(20px,80px) scaleX(1);opacity:0} }
        .triple-ball  { position:absolute;top:0;left:0;animation:triple-ball 0.9s cubic-bezier(0.1,0,0.2,1) 0.1s forwards }
        .triple-smoke { position:absolute;top:0;left:0;animation:triple-smoke 0.9s ease-out 0.1s forwards }
      `}</style>
      {/* Horizontal speed streaks */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 120">
        {[0,8,16,24,32].map(dy => (
          <line key={dy}
            x1="20" y1={82 + dy - 16} x2="285" y2={44 + dy - 16}
            stroke={dy === 16 ? `${color}40` : 'rgba(255,255,255,0.06)'}
            strokeWidth={dy === 16 ? 2 : 1} strokeLinecap="round"
          >
            <animate attributeName="x1" from="285" to="20" dur="0.9s" begin="0.1s" fill="freeze" />
          </line>
        ))}
      </svg>
      <div className="triple-ball" style={{ opacity: 0 }}><Baseball size={28} /></div>
      <div className="absolute bottom-0 left-0 right-0"><Fence /></div>
    </div>
  );
}

// ── Cycle animation — 4 balls in orbit ───────────────────────────────────────
export function CycleAnimation() {
  const COLORS = ['#3b82f6', '#22c55e', '#f97316', '#f59e0b'];
  const LABELS = ['1B', '2B', '3B', 'HR'];
  return (
    <div className="relative w-full overflow-hidden flex items-center justify-center" style={{ height: 140 }}>
      <style>{`
        @keyframes orbit-0 { 0%{transform:rotate(0deg)   translateX(60px) rotate(0deg)} 100%{transform:rotate(360deg)  translateX(60px) rotate(-360deg)} }
        @keyframes orbit-1 { 0%{transform:rotate(90deg)  translateX(60px) rotate(-90deg)} 100%{transform:rotate(450deg) translateX(60px) rotate(-450deg)} }
        @keyframes orbit-2 { 0%{transform:rotate(180deg) translateX(60px) rotate(-180deg)} 100%{transform:rotate(540deg) translateX(60px) rotate(-540deg)} }
        @keyframes orbit-3 { 0%{transform:rotate(270deg) translateX(60px) rotate(-270deg)} 100%{transform:rotate(630deg) translateX(60px) rotate(-630deg)} }
        @keyframes cycle-glow { 0%,100%{opacity:0.5} 50%{opacity:1} }
        .orbit-0 { animation: orbit-0 3s linear infinite; }
        .orbit-1 { animation: orbit-1 3s linear infinite; }
        .orbit-2 { animation: orbit-2 3s linear infinite; }
        .orbit-3 { animation: orbit-3 3s linear infinite; }
        .cycle-glow { animation: cycle-glow 1.5s ease-in-out infinite; }
      `}</style>
      {/* Center trophy star */}
      <div className="absolute flex items-center justify-center">
        <div className="cycle-glow text-3xl">🏆</div>
      </div>
      {/* Orbiting balls */}
      {COLORS.map((c, i) => (
        <div key={i} className={`orbit-${i}`} style={{ position: 'absolute' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Baseball size={22} />
            <span style={{ fontSize: 9, fontWeight: 900, color: c, letterSpacing: '0.05em' }}>{LABELS[i]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Root dispatcher ──────────────────────────────────────────────────────────
export default function BaseballEventAnimation({ eventType, color }: { eventType: PlayEventType; color: string }) {
  if (eventType === 'grand_slam') return <GrandSlamAnimation color={color} />;
  if (eventType === 'cycle')      return <CycleAnimation />;
  if (eventType === 'triple')     return <TripleAnimation color={color} />;
  if (eventType === 'home_run')   return <HomeRunAnimation color={color} />;
  return null;
}
