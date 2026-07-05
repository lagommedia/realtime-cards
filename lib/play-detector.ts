export type PlayEventType =
  // ── Hitter — standard ──────────────────────────────────────────────────────
  | 'single'
  | 'double'
  | 'triple'
  | 'home_run'
  | 'grand_slam'
  | 'cycle'
  | 'stolen_base'
  // ── Hitter — specialty ────────────────────────────────────────────────────
  | 'walk_off_hr'
  | 'multi_hr_game'
  | 'five_rbi_game'
  | 'inside_park_hr'
  // ── Pitcher ───────────────────────────────────────────────────────────────
  | 'perfect_game'
  | 'no_hitter'
  | 'pitcher_k_15plus'
  | 'cg_shutout'
  // ── Awards & Milestones ───────────────────────────────────────────────────
  | 'mvp_award'
  | 'cy_young_award'
  | 'rookie_of_year'
  | 'hr_milestone_50'
  | 'world_series_win'
  // ── Negative — injury / roster ────────────────────────────────────────────
  | 'season_ending_injury'
  | 'il_60_day'
  | 'il_15_day'
  | 'suspension'
  | 'dfa'
  // ── Negative — in-game ────────────────────────────────────────────────────
  | 'strikeout'
  | 'groundout'
  | 'flyout'
  | 'double_play';

export type PlayTier = 'minor' | 'notable' | 'major' | 'epic';

export interface RawPlay {
  atBatIndex: number;
  batterId: number;
  event: string;
  description: string;
  rbi: number;
}

export interface LiveGamePlays {
  gameId: number;
  isLive: boolean;
  plays: RawPlay[];
  playerNames: Record<number, string>;
}

export interface WatchedPlayerEvent {
  id: string;
  playerId: number;
  playerName: string;
  eventType: PlayEventType;
  description: string;
  rbi: number;
  gameId: number;
  atBatIndex: number;
  timestamp: number;
}

const NEGATIVE_EVENTS = new Set<PlayEventType>([
  'strikeout', 'groundout', 'flyout', 'double_play',
  'season_ending_injury', 'il_60_day', 'il_15_day', 'suspension', 'dfa',
]);

export function isPositiveEvent(t: PlayEventType): boolean {
  return !NEGATIVE_EVENTS.has(t);
}

// Returns the event type if this play is worth notifying about, null otherwise.
// playerHitTypes is mutated to track cycle progress per player per game.
export function classifyPlay(
  event: string,
  rbi: number,
  playerHitTypes: Set<string>,
): PlayEventType | null {
  const e = event.toLowerCase().trim();

  // ── Positive events ──────────────────────────────────────────────────────
  if (e === 'home run') {
    if (rbi === 4) return 'grand_slam';
    playerHitTypes.add('home_run');
    if (hasCycle(playerHitTypes)) return 'cycle';
    return 'home_run';
  }
  if (e === 'single') {
    playerHitTypes.add('single');
    if (hasCycle(playerHitTypes)) return 'cycle';
    return 'single';
  }
  if (e === 'double') {
    playerHitTypes.add('double');
    if (hasCycle(playerHitTypes)) return 'cycle';
    return 'double';
  }
  if (e === 'triple') {
    playerHitTypes.add('triple');
    if (hasCycle(playerHitTypes)) return 'cycle';
    return 'triple';
  }
  if (e.startsWith('stolen base')) return 'stolen_base';

  // ── Negative events (outs) ───────────────────────────────────────────────
  if (e === 'strikeout' || e === 'strikeout - double play') return 'strikeout';
  if (e === 'grounded into dp' || e === 'double play' || e.includes('double play')) return 'double_play';
  if (e === 'groundout' || e === 'bunt groundout' || e === 'fielders choice out') return 'groundout';
  if (e === 'flyout' || e === 'pop out' || e === 'bunt pop out' || e === 'lineout' || e === 'sac fly') return 'flyout';

  return null;
}

function hasCycle(hits: Set<string>): boolean {
  return hits.has('single') && hits.has('double') && hits.has('triple') && hits.has('home_run');
}

export function getEventTier(t: PlayEventType): PlayTier {
  switch (t) {
    case 'single':
    case 'double':
    case 'stolen_base':
    case 'strikeout':
    case 'groundout':
    case 'flyout':
      return 'minor';
    case 'triple':
    case 'double_play':
      return 'notable';
    case 'home_run':
      return 'major';
    case 'grand_slam':
    case 'cycle':
      return 'epic';
  }
}

export function getEventEmoji(t: PlayEventType): string {
  switch (t) {
    // Hitter standard
    case 'single':               return '🎯';
    case 'double':               return '⚡';
    case 'triple':               return '🔥';
    case 'stolen_base':          return '💨';
    case 'home_run':             return '💥';
    case 'grand_slam':           return '🚀';
    case 'cycle':                return '🏆';
    // Hitter specialty
    case 'walk_off_hr':          return '🎆';
    case 'multi_hr_game':        return '🔁';
    case 'five_rbi_game':        return '💰';
    case 'inside_park_hr':       return '🌀';
    // Pitcher
    case 'perfect_game':         return '💎';
    case 'no_hitter':            return '🧊';
    case 'pitcher_k_15plus':     return '🌪️';
    case 'cg_shutout':           return '🛡️';
    // Awards & milestones
    case 'mvp_award':            return '🥇';
    case 'cy_young_award':       return '🏅';
    case 'rookie_of_year':       return '⭐';
    case 'hr_milestone_50':      return '5️⃣0️⃣';
    case 'world_series_win':     return '🎊';
    // Negative — injury/roster
    case 'season_ending_injury': return '🚑';
    case 'il_60_day':            return '🩹';
    case 'il_15_day':            return '🩺';
    case 'suspension':           return '⛔';
    case 'dfa':                  return '📉';
    // Negative — in-game
    case 'strikeout':            return '❌';
    case 'groundout':            return '⬇️';
    case 'flyout':               return '⬇️';
    case 'double_play':          return '‼️';
  }
}

export function getEventLabel(t: PlayEventType): string {
  switch (t) {
    // Hitter standard
    case 'single':               return 'Single';
    case 'double':               return 'Double';
    case 'triple':               return 'Triple';
    case 'stolen_base':          return 'Stolen Base';
    case 'home_run':             return 'HOME RUN';
    case 'grand_slam':           return 'GRAND SLAM';
    case 'cycle':                return 'HIT FOR THE CYCLE';
    // Hitter specialty
    case 'walk_off_hr':          return 'WALK-OFF HOME RUN';
    case 'multi_hr_game':        return 'MULTI-HR GAME';
    case 'five_rbi_game':        return '5+ RBI GAME';
    case 'inside_park_hr':       return 'INSIDE-THE-PARK HR';
    // Pitcher
    case 'perfect_game':         return 'PERFECT GAME';
    case 'no_hitter':            return 'NO-HITTER';
    case 'pitcher_k_15plus':     return '15+ STRIKEOUT GAME';
    case 'cg_shutout':           return 'COMPLETE GAME SHUTOUT';
    // Awards & milestones
    case 'mvp_award':            return 'MVP AWARD';
    case 'cy_young_award':       return 'CY YOUNG AWARD';
    case 'rookie_of_year':       return 'ROOKIE OF THE YEAR';
    case 'hr_milestone_50':      return '50th HOME RUN';
    case 'world_series_win':     return 'WORLD SERIES CHAMPION';
    // Negative — injury/roster
    case 'season_ending_injury': return 'SEASON-ENDING INJURY';
    case 'il_60_day':            return '60-Day IL Placement';
    case 'il_15_day':            return '15-Day IL Placement';
    case 'suspension':           return 'Suspension';
    case 'dfa':                  return 'Designated for Assignment';
    // Negative — in-game
    case 'strikeout':            return 'Strikeout';
    case 'groundout':            return 'Ground Out';
    case 'flyout':               return 'Fly Out';
    case 'double_play':          return 'Double Play';
  }
}

export function getEventColor(t: PlayEventType): string {
  switch (t) {
    // Hitter standard — green spectrum
    case 'single':
    case 'double':               return '#4ade80';  // green-400
    case 'triple':               return '#22c55e';  // green-500
    case 'stolen_base':          return '#34d399';  // emerald-400
    case 'home_run':             return '#4ade80';  // green-400
    case 'grand_slam':           return '#86efac';  // green-300
    case 'cycle':                return '#f59e0b';  // amber — legendary
    // Hitter specialty
    case 'walk_off_hr':          return '#f59e0b';  // amber — walk-off = legendary moment
    case 'multi_hr_game':        return '#34d399';  // emerald
    case 'five_rbi_game':        return '#a3e635';  // lime
    case 'inside_park_hr':       return '#22c55e';  // green-500
    // Pitcher — blue/cyan spectrum
    case 'perfect_game':         return '#e879f9';  // fuchsia — rarest achievement
    case 'no_hitter':            return '#818cf8';  // indigo-400
    case 'pitcher_k_15plus':     return '#60a5fa';  // blue-400
    case 'cg_shutout':           return '#38bdf8';  // sky-400
    // Awards & milestones — gold spectrum
    case 'mvp_award':            return '#fbbf24';  // amber-400
    case 'cy_young_award':       return '#fbbf24';  // amber-400
    case 'rookie_of_year':       return '#fcd34d';  // amber-300
    case 'hr_milestone_50':      return '#f59e0b';  // amber-500
    case 'world_series_win':     return '#fb923c';  // orange-400
    // Negative — injury/roster — red spectrum
    case 'season_ending_injury': return '#dc2626';  // red-600
    case 'il_60_day':            return '#ef4444';  // red-500
    case 'il_15_day':            return '#f87171';  // red-400
    case 'suspension':           return '#f97316';  // orange-500
    case 'dfa':                  return '#fb923c';  // orange-400
    // Negative — in-game
    case 'strikeout':            return '#ef4444';  // red-500
    case 'groundout':
    case 'flyout':               return '#f87171';  // red-400
    case 'double_play':          return '#dc2626';  // red-600
  }
}

export function tierOrder(tier: PlayTier): number {
  return { minor: 0, notable: 1, major: 2, epic: 3 }[tier];
}
