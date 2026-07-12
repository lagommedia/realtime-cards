import type { Metadata, Viewport } from 'next';
import './globals.css';
import { TeamProvider } from '@/context/TeamContext';
import { WatchListProvider } from '@/context/WatchListContext';
import { LiveEventsProvider } from '@/context/LiveEventsContext';
import { BroadcastProvider } from '@/context/BroadcastContext';
import { GradingProvider } from '@/context/GradingContext';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'CardTracker MLB',
  description: 'Real-time MLB card value predictions powered by live stats and eBay pricing',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#eef4fb',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased" style={{ color: '#fff', minHeight: '100dvh' }}>
        <TeamProvider>
          <BroadcastProvider>
            <GradingProvider>
            <WatchListProvider>
              <LiveEventsProvider>
                {/* Orbs inside TeamProvider so they inherit --color-primary/secondary/accent CSS vars */}
                <div className="orb-container" aria-hidden="true">
                  <div className="orb orb-1" />
                  <div className="orb orb-2" />
                  <div className="orb orb-3" />
                </div>
                <div className="min-h-dvh max-w-lg mx-auto relative" style={{ zIndex: 1 }}>
                  <main className="pb-28">{children}</main>
                  <Navigation />
                </div>
              </LiveEventsProvider>
            </WatchListProvider>
            </GradingProvider>
          </BroadcastProvider>
        </TeamProvider>
      </body>
    </html>
  );
}
