import { PlayEventType, isPositiveEvent } from '@/lib/play-detector';

export type NotificationTier = 1 | 2 | 3 | 4;

export interface TierConfig {
  tier: NotificationTier;
  name: string;
  icon: string;
  sendPush: boolean;
  silent: boolean;                           // true = no sound/vibration
  urgency: 'very-high' | 'high' | 'normal' | 'low';
  ttl: number;                               // push TTL in seconds
  autoDismissMs: number | null;              // null = stays until user taps
  inAppStyle: 'fullscreen' | 'overlay' | 'toast' | 'none';
  vibrate: number[];                         // vibration pattern
}

export const TIER_CONFIGS: Record<NotificationTier, TierConfig> = {
  // ── Tier 1: Full-Screen Takeover ───────────────────────────────────────────
  // Historic moments: cycle, perfect game, milestone 50th HR, MVP, season-ending injury
  // Market impact: +40–200%+ or −30–70%
  1: {
    tier: 1,
    name: 'Full-Screen Takeover',
    icon: '🚨',
    sendPush: true,
    silent: false,
    urgency: 'very-high',
    ttl: 86400,
    autoDismissMs: null,
    inAppStyle: 'fullscreen',
    vibrate: [300, 100, 300, 100, 600],      // dramatic triple burst
  },

  // ── Tier 2: Push + Sound ────────────────────────────────────────────────────
  // Major events: HR, grand slam, IL placement, price drop >15%
  // Market impact: +10–40% or −10–30%
  2: {
    tier: 2,
    name: 'Push + Sound',
    icon: '🔔',
    sendPush: true,
    silent: false,
    urgency: 'high',
    ttl: 3600,
    autoDismissMs: null,
    inAppStyle: 'overlay',
    vibrate: [200, 100, 200],                // standard double buzz
  },

  // ── Tier 3: Silent Push ─────────────────────────────────────────────────────
  // Notable plays: triple, stolen base, double play, 10-11 Ks
  // Market impact: +4–12% or −4–10%
  3: {
    tier: 3,
    name: 'Silent Push',
    icon: '🔕',
    sendPush: true,
    silent: true,
    urgency: 'normal',
    ttl: 1800,
    autoDismissMs: 5000,
    inAppStyle: 'toast',
    vibrate: [],                             // no vibration
  },

  // ── Tier 4: In-App Log Only ─────────────────────────────────────────────────
  // Routine plays: single, double, strikeout, groundout, flyout
  // No market signal worth interrupting
  4: {
    tier: 4,
    name: 'In-App Log',
    icon: '📋',
    sendPush: false,
    silent: true,
    urgency: 'low',
    ttl: 0,
    autoDismissMs: 0,
    inAppStyle: 'none',
    vibrate: [],
  },
};

// ── Event → Tier mapping ──────────────────────────────────────────────────────

export function getEventNotificationTier(eventType: PlayEventType): NotificationTier {
  switch (eventType) {
    // ── Tier 1: Full-Screen Takeover ─────────────────────────────────────────
    // Historic, market-moving moments (+40–200% or −30–70%)
    case 'cycle':
    case 'walk_off_hr':
    case 'perfect_game':
    case 'no_hitter':
    case 'mvp_award':
    case 'cy_young_award':
    case 'hr_milestone_50':
    case 'world_series_win':
    case 'season_ending_injury':
      return 1;

    // ── Tier 2: Push + Sound ──────────────────────────────────────────────────
    // Major events (+10–40% or −10–30%)
    case 'grand_slam':
    case 'home_run':
    case 'multi_hr_game':
    case 'five_rbi_game':
    case 'inside_park_hr':
    case 'pitcher_k_15plus':
    case 'cg_shutout':
    case 'rookie_of_year':
    case 'il_60_day':
    case 'suspension':
      return 2;

    // ── Tier 3: Silent Push ───────────────────────────────────────────────────
    // Notable plays (+4–12% or −4–10%)
    case 'triple':
    case 'stolen_base':
    case 'double_play':
    case 'il_15_day':
    case 'dfa':
      return 3;

    // ── Tier 4: In-App Log only ───────────────────────────────────────────────
    case 'double':
    case 'single':
    case 'strikeout':
    case 'groundout':
    case 'flyout':
    default:
      return 4;
  }
}

export function getTierAlertLabel(eventType: PlayEventType): string {
  const tier = getEventNotificationTier(eventType);
  if (tier !== 1) return '';
  switch (eventType) {
    case 'perfect_game':         return '💎 HISTORIC ACHIEVEMENT';
    case 'no_hitter':            return '🧊 NO-HITTER ALERT';
    case 'cycle':                return '🏆 CYCLE ALERT';
    case 'walk_off_hr':          return '🎆 WALK-OFF ALERT';
    case 'mvp_award':            return '🥇 AWARD ALERT';
    case 'cy_young_award':       return '🏅 AWARD ALERT';
    case 'hr_milestone_50':      return '5️⃣0️⃣ MILESTONE ALERT';
    case 'world_series_win':     return '🎊 CHAMPION ALERT';
    case 'season_ending_injury': return '🚑 INJURY ALERT';
    default:                     return isPositiveEvent(eventType) ? '🚨 CARD MARKET ALERT' : '🚨 MARKET ALERT';
  }
}
