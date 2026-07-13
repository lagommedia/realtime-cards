'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTeam } from '@/context/TeamContext';
import { TrendingUp, Settings, Tv, Star } from 'lucide-react';
import TeamLogo from '@/components/TeamLogo';
import { ALL_TEAMS } from '@/lib/team-themes';
import { motion, LayoutGroup } from 'framer-motion';

const NAV_ITEMS = [
  { href: '/', label: 'Games', icon: Tv },
  { href: '/trending', label: 'Trending', icon: TrendingUp },
  { href: '/watchlist', label: 'Watchlist', icon: Star },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Navigation() {
  const pathname = usePathname();
  const { theme, selectedTeamId } = useTeam();
  const selectedTeam = ALL_TEAMS.find(t => t.id === selectedTeamId);

  return (
    /* backdrop-filter must live on the position:fixed element itself —
       not on a child — for WKWebView to composite blur correctly */
    <nav
      className="liquid-glass-nav fixed z-50 pointer-events-auto"
      style={{
        left: '50%',
        transform: 'translateX(-50%) translateZ(0)',
        bottom: 'max(14px, env(safe-area-inset-bottom))',
        width: 'calc(100% - 2rem)',
        maxWidth: '512px',
      }}
    >
      {/*
        SVG filter: feTurbulence → feDisplacementMap creates the edge-refraction
        shimmer. Applied only to the decorative overlay (not icons/text).
      */}
      <svg aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          <filter id="lg-edge-refract" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.022 0.028" numOctaves="2" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* Edge refraction shimmer overlay — decorative, sits above glass layers */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 999,
          background: 'radial-gradient(ellipse 100% 100% at 50% 0%, rgba(255,255,255,0.22) 0%, transparent 65%)',
          filter: 'url(#lg-edge-refract)',
          pointerEvents: 'none',
          zIndex: 3,
          mixBlendMode: 'screen',
        }}
      />

      <LayoutGroup>
        <div className="flex items-center justify-around px-2 py-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              const isSettings = href === '/settings';
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative flex flex-col items-center gap-0.5 px-3 py-2"
                  style={{ color: active ? theme.primary : 'rgba(15,23,42,0.5)', zIndex: 1 }}
                >
                  {/* Liquid spring bubble — shared layout across all items */}
                  {active && (
                    <motion.span
                      layoutId="nav-bubble"
                      aria-hidden="true"
                      initial={{ scale: 1.18, opacity: 0.6 }}
                      animate={{ scale: 1, opacity: 1 }}
                      style={{
                        position: 'absolute',
                        inset: '0px',
                        borderRadius: 999,
                        background: 'rgba(255,255,255,1)',
                        border: '1px solid rgba(255,255,255,1)',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
                        zIndex: 0,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 22,
                        mass: 0.85,
                      }}
                    />
                  )}

                  {isSettings && selectedTeam ? (
                    <span className="relative" style={{ zIndex: 1, opacity: active ? 1 : 0.55 }}>
                      <TeamLogo teamId={selectedTeam.id} abbreviation={selectedTeam.abbreviation} size={20} />
                    </span>
                  ) : (
                    <Icon
                      size={20}
                      strokeWidth={active ? 2.5 : 1.8}
                      style={{ position: 'relative', zIndex: 1 }}
                    />
                  )}
                  <span
                    className="text-[10px] font-semibold tracking-tight"
                    style={{ position: 'relative', zIndex: 1 }}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </LayoutGroup>
    </nav>
  );
}
