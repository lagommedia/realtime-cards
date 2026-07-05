'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useWatchedPlayerEvents } from '@/hooks/useWatchedPlayerEvents';
import { usePushSubscription, PushStatus } from '@/hooks/usePushSubscription';
import PlayCelebrationLayer from '@/components/PlayCelebrationLayer';
import { WatchedPlayerEvent, PlayEventType } from '@/lib/play-detector';

interface LiveEventsContextValue {
  pendingEvent: WatchedPlayerEvent | null;
  fireTestEvent: (playerId: number, playerName: string, eventType: PlayEventType) => void;
  pushStatus: PushStatus;
  subscribeToPush: () => Promise<PushSubscription | null>;
  sendPush: (payload: { title: string; body: string; url: string; tag?: string; tier?: 1 | 2 | 3 | 4; silent?: boolean }) => Promise<void>;
}

const LiveEventsContext = createContext<LiveEventsContextValue>({
  pendingEvent: null,
  fireTestEvent: () => {},
  pushStatus: 'loading',
  subscribeToPush: async () => null,
  sendPush: async () => {},
});

export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const { pendingEvent: polledEvent, clearEvent: clearPolled } = useWatchedPlayerEvents();
  const { status: pushStatus, subscribe: subscribeToPush, sendPush } = usePushSubscription();
  const [testEvent, setTestEvent] = useState<WatchedPlayerEvent | null>(null);

  const fireTestEvent = useCallback((playerId: number, playerName: string, eventType: PlayEventType) => {
    const DESCRIPTIONS: Record<PlayEventType, string> = {
      // Hitter standard
      single:               `${playerName} singles on a line drive to left field.`,
      double:               `${playerName} doubles on a sharp ground ball down the left-field line.`,
      triple:               `${playerName} triples on a fly ball to deep center field!`,
      stolen_base:          `${playerName} steals second base.`,
      home_run:             `${playerName} homers (No. 24) on a fly ball to left center field.`,
      grand_slam:           `${playerName} hits a grand slam (No. 12) to deep right field. 4 score!`,
      cycle:                `${playerName} hits a single completing the cycle — single, double, triple, and home run!`,
      // Hitter specialty
      walk_off_hr:          `${playerName} hits a WALK-OFF home run in the bottom of the 9th! The crowd erupts!`,
      multi_hr_game:        `${playerName} hits his 2nd home run of the game — a towering shot to center field.`,
      five_rbi_game:        `${playerName} drives in his 5th run of the night with a bases-clearing double.`,
      inside_park_hr:       `${playerName} hits an inside-the-park home run! Races around the bases!`,
      // Pitcher
      perfect_game:         `${playerName} retires the final batter — a PERFECT GAME! 27 up, 27 down. Historic!`,
      no_hitter:            `${playerName} completes the NO-HITTER! 9 innings, 0 hits, 12 strikeouts.`,
      pitcher_k_15plus:     `${playerName} fans his 15th batter of the night — a dominant performance.`,
      cg_shutout:           `${playerName} completes the shutout — a complete-game gem. 9 IP, 3 H, 0 R, 11 K.`,
      // Awards & milestones
      mvp_award:            `${playerName} has been named the AL/NL Most Valuable Player. Historic season!`,
      cy_young_award:       `${playerName} wins the Cy Young Award, the best pitcher in the league.`,
      rookie_of_year:       `${playerName} wins Rookie of the Year — a dominant debut season.`,
      hr_milestone_50:      `${playerName} launches his 50th home run of the season into the upper deck!`,
      world_series_win:     `${playerName} and the team win the World Series! Champions!`,
      // Negative — injury/roster
      season_ending_injury: `${playerName} placed on 60-day IL with a torn UCL. Out for the season.`,
      il_60_day:            `${playerName} transferred to 60-day IL. Expected to miss 8–10 weeks.`,
      il_15_day:            `${playerName} placed on 15-day IL with a hamstring strain.`,
      suspension:           `${playerName} suspended 80 games following a positive PED test.`,
      dfa:                  `${playerName} designated for assignment. Must be traded, released, or outrighted.`,
      // Negative — in-game
      strikeout:            `${playerName} struck out swinging on a 94 mph fastball.`,
      groundout:            `${playerName} grounds out, shortstop to first baseman.`,
      flyout:               `${playerName} flies out to center field.`,
      double_play:          `${playerName} hits into a 6-4-3 double play to end the inning.`,
    };
    const RBI: Record<PlayEventType, number> = {
      grand_slam: 4, walk_off_hr: 1, home_run: 2, cycle: 1,
      multi_hr_game: 2, five_rbi_game: 5, inside_park_hr: 1,
      single: 0, double: 0, triple: 0, stolen_base: 0,
      perfect_game: 0, no_hitter: 0, pitcher_k_15plus: 0, cg_shutout: 0,
      mvp_award: 0, cy_young_award: 0, rookie_of_year: 0, hr_milestone_50: 1, world_series_win: 0,
      season_ending_injury: 0, il_60_day: 0, il_15_day: 0, suspension: 0, dfa: 0,
      strikeout: 0, groundout: 0, flyout: 0, double_play: 0,
    };
    setTestEvent({
      id: `test-${playerId}-${Date.now()}`,
      playerId,
      playerName,
      eventType,
      description: DESCRIPTIONS[eventType],
      rbi: RBI[eventType] ?? 0,
      gameId: 0,
      atBatIndex: -1,
      timestamp: Date.now(),
    });
  }, []);

  const activeEvent = testEvent ?? polledEvent;
  const clearActive = useCallback(() => {
    setTestEvent(null);
    clearPolled();
  }, [clearPolled]);

  return (
    <LiveEventsContext.Provider value={{ pendingEvent: activeEvent, fireTestEvent, pushStatus, subscribeToPush, sendPush }}>
      {children}
      <PlayCelebrationLayer event={activeEvent} onDismiss={clearActive} sendPush={sendPush} />
    </LiveEventsContext.Provider>
  );
}

export function useLiveEvents() {
  return useContext(LiveEventsContext);
}
