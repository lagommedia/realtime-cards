'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTeam } from '@/context/TeamContext';
import { TrendingUp, Settings, Tv, Star } from 'lucide-react';
import TeamLogo from '@/components/TeamLogo';
import { ALL_TEAMS } from '@/lib/team-themes';

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
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10"
      style={{ backgroundColor: theme.cardBackground }}
    >
      <div className="flex items-center justify-around py-2 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          const isSettings = href === '/settings';
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all"
              style={{ color: active ? theme.primary : '#9ca3af' }}
            >
              {isSettings && selectedTeam ? (
                <div style={{ opacity: active ? 1 : 0.6 }}>
                  <TeamLogo teamId={selectedTeam.id} abbreviation={selectedTeam.abbreviation} size={22} />
                </div>
              ) : (
                <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
              )}
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
