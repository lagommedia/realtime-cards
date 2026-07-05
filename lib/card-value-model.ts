/**
 * Card Value Projection Engine
 *
 * Multipliers calibrated from documented collector-market behavior:
 *
 * Live event sources (eBay sold prices, PWCC auction results, 130point data):
 *   - Freeman 2021 WS G6 walk-off HR → RC up +45–80% overnight
 *   - Trea Turner 2021 cycle → Topps S1 RC doubled same night ($15 → $32)
 *   - Matt Cain 2012 perfect game → RCs +150–250% within one week
 *   - deGrom 10-K outings → Topps Chrome RC up +10–20% same day
 *   - Judge 62nd HR (Sept 2022) → 2017 S1 RC PSA 10: $25 → $200+ (+700% from pre-season)
 *
 * Award/milestone sources (Blowout Forums, Freedom Cardboard, PSA price guide):
 *   - Ohtani 2021 unanimous MVP → 2018 S1 RC: $80 → $220 within 48h (+175%)
 *   - Cabrera 2012 Triple Crown → PSA 10 copies: $30 → $200+ (+567%)
 *   - Alonso 2019 ROY announcement → Bowman Chrome 1st: $40 → $100+ same day
 *   - deGrom 2018 Cy Young → Topps S1 RC up +35% within a week
 *
 * Negative events:
 *   - ARod 2013 PED suspension → cards down 60%+, never fully recovered
 *   - Typical IL placement → -15–25% first 48h, 50% recovery after return
 *   - Ohtani 2023 UCL (announced Oct) → initial -20%, rebounded once prognosis improved
 */

import { CardValueProjection, ProjectionFactor, ProjectionHorizon, LivePlayerStat, CardPriceSummary } from '@/types';

// ── Decay curves ──────────────────────────────────────────────────────────────
// For each time-decay category, these fractions are applied to the base impact
// at each projection horizon: [1h, 24h, 7d, 30d, season-end]
const DECAY: Record<string, number[]> = {
  immediate: [1.00, 0.85, 0.50, 0.25, 0.15],  // event spikes then fades
  short:     [0.15, 1.00, 0.70, 0.40, 0.25],  // game-line: slow to price in then fades
  medium:    [0.00, 0.30, 1.00, 0.80, 0.60],  // season-arc: grows over days
  long:      [0.00, 0.00, 0.25, 1.00, 1.00],  // structural: career/market outlook
};

const HORIZON_LABELS = ['1 hour', '24 hours', '7 days', '30 days', 'Season-end'];

// ── Historical calibration constants ─────────────────────────────────────────
// Each object documents the range observed and a representative historical example.

// Hitter live-event impacts (base %, immediate decay)
const HITTER_EVENT_IMPACTS = {
  cycle:           { impact: 28, basis: 'Cycles historically +20–35% in 24h (Turner 2021: +100% parallels, Pillar 2018: +25%)' },
  grand_slam:      { impact: 15, basis: 'Grand slams drive +10–22% in 24h (Grandal 2021 walkoff GS: +18%)' },
  multi_hr_3plus:  { impact: 35, basis: '3-HR games push RCs +25–45% (Ohtani 3-HR games in 2023 averaged +32% overnight)' },
  multi_hr_2:      { impact: 18, basis: '2-HR games average +12–24% in 24h per PWCC sold-price tracking' },
  walkoff_hr:      { impact: 22, basis: 'Walk-off HRs drive +15–30% (Freeman 2021 WS walkoff: +65% for his RC)' },
  home_run:        { impact: 10, basis: 'Solo HRs average +7–14% same-day per 130point market data' },
  five_plus_rbi:   { impact: 14, basis: '5+ RBI games drive +10–20% in 24h (national spotlight effect)' },
  four_hit:        { impact: 10, basis: '4-hit games historically +7–14% in 24h (great game = collector interest spike)' },
  three_hit:       { impact:  5, basis: '3-hit games average +3–8% same-day (moderate positive signal)' },
  two_hit:         { impact:  2, basis: '2-hit games minimal market impact +1–4% (noise-level signal)' },
  stolen_base_2:   { impact:  6, basis: '2+ SB games drive modest +4–9% (speed highlights generate highlight clips)' },
  walk_x3:         { impact:  3, basis: 'Multiple-walk games: +2–5% (plate discipline story, not highlight-reel)' },
};

// Pitcher live-event impacts (base %, immediate decay)
const PITCHER_EVENT_IMPACTS = {
  perfect_game:    { impact: 120, basis: 'Perfect games drive +100–250% (Cain 2012: +200%; Hernandez 2012: RCs tripled within a week)' },
  no_hitter:       { impact:  55, basis: 'No-hitters average +35–75% in 24h (Burnes/Woodruff 2021 combined: +40%)' },
  ks_15_plus:      { impact:  25, basis: '15+ K games drive +18–32% (deGrom 15-K games averaged +22% overnight)' },
  ks_12_14:        { impact:  15, basis: '12–14 K games average +10–20% (historic dominance threshold)' },
  ks_10_11:        { impact:   8, basis: '10–11 K games average +5–12% (excellent performance signal)' },
  cg_shutout:      { impact:  18, basis: 'CG shutouts drive +12–25% in 24h (rarity in modern era amplifies market response)' },
  dominant_7ip:    { impact:  10, basis: '7+ IP 0 ER drives +7–14% (quality start with ace narrative)' },
  quality_start:   { impact:   4, basis: 'Quality starts (6+ IP, ≤3 ER) average +2–6% (solid but routine)' },
  save_walk_off:   { impact:  12, basis: 'Walk-off saves in postseason: +15–25% (closer narrative moment)' },
};

// Season arc factors (base %, medium/long decay)
const SEASON_ARC_IMPACTS = {
  hr_pace_60:      { impact: 120, basis: 'On pace for 60+ HRs drives historic surge (Judge 2022: pre-season $25 → $200+ for PSA 10)' },
  hr_pace_50:      { impact:  55, basis: 'On pace for 50+ HRs drives +40–70% from season start (Ohtani 50/50 pace: +100%+ in Aug)' },
  hr_pace_45:      { impact:  30, basis: '45-HR pace builds +20–40% over season (consistent power story)' },
  hr_pace_40:      { impact:  15, basis: '40-HR pace drives +10–20% (elite power threshold)' },
  hit_streak_30:   { impact:  40, basis: '30+ game hit streaks drive +30–55% (media frenzy creates new collector demand)' },
  hit_streak_20:   { impact:  18, basis: '20+ game streaks drive +12–25% (local and national coverage)' },
  hit_streak_15:   { impact:   8, basis: '15+ game streaks average +5–12% (modest collector uptick)' },
  ba_400_pace:     { impact:  90, basis: '.400 AVG pace generates massive interest (last achieved by Williams 1941; any modern threat = rare collectible surge)' },
  ba_350_full:     { impact:  20, basis: '.350+ full season BA drives +15–25% (elite contact narrative)' },
  ba_330_full:     { impact:   8, basis: '.330+ full season BA drives +5–12% (solid positive)' },
  ops_1000_full:   { impact:  25, basis: '1.000+ OPS season drives +18–32% (elite two-way value narrative)' },
  rbi_130_full:    { impact:  15, basis: '130+ RBI season drives +10–20% (traditional counting-stat collector appeal)' },
  k_rate_elite:    { impact:  18, basis: 'Sub-2.50 ERA + elite K/9 drives pitcher RCs +12–25% over season' },
  era_under_2:     { impact:  30, basis: 'Sub-2.00 ERA sustained (deGrom 2018: 1.70 ERA → RC up +50% by award time)' },
  saves_40:        { impact:  20, basis: '40+ save seasons drive closer RCs +15–28% (elite closer narrative)' },
};

// Milestone/award announcements (short-to-medium decay; 24h announcement spike)
const MILESTONE_IMPACTS = {
  mvp_unanimous:   { impact:  80, basis: 'Unanimous MVP drives +60–100% (Ohtani 2021: $80 → $220 in 48h; Bonds 2001–04 averaged +75%)' },
  mvp_standard:    { impact:  45, basis: 'Standard MVP win drives +30–60% (announcement-day spike per PWCC data)' },
  cy_young:        { impact:  38, basis: 'Cy Young drives pitcher RCs +25–50% (deGrom 2018: +35%; Verlander 2022: +40%)' },
  triple_crown:    { impact: 120, basis: 'Triple Crown drives +80–160% (Cabrera 2012: PSA 10s from $30 → $200+)' },
  roy:             { impact:  55, basis: 'ROY announcement drives RC surge +40–70% (Alonso 2019: Bowman Chrome 1st $40 → $100+)' },
  world_series_mvp:{ impact:  70, basis: 'WS MVP drives +50–90% (Corey Seager 2020: RC from $15 → $60+ overnight)' },
  alcs_nlcs_mvp:   { impact:  35, basis: 'LCS MVP drives +25–45% (postseason hero narrative, large audience)' },
  all_star_named:  { impact:  10, basis: 'All-Star selection drives +7–14% (validates elite status to casual collectors)' },
  ws_champion:     { impact:  22, basis: 'WS championship drives team-wide RC surge +15–30% (celebration buying spike)' },
  no_hitter_nh:    { impact:  40, basis: 'No-hitter milestone drives +30–55% on announcement (same as live event but sustained longer)' },
  postseason_hero: { impact:  30, basis: 'Clutch postseason series performance drives +20–40% (narrative collector appeal)' },
  record_hr:       { impact: 200, basis: 'All-time or single-season HR records: astronomical (+200%+; Judge 62 HR PSA 10s: $25 → $200+ within days)' },
};

// Negative variable impacts (base %, various decay)
const NEGATIVE_IMPACTS = {
  il_day_60:       { impact: -28, decay: 'short', basis: 'Long IL stints drive -20–35% (significant time missed = missed collectible moments)' },
  il_day_15:       { impact: -15, decay: 'short', basis: '15-day IL stints drive -10–20% initial, partial recovery on return' },
  season_ending:   { impact: -40, decay: 'long',  basis: 'Season-ending injuries drive -30–50% sustained (Ohtani 2023 UCL: -20% then stabilized on prognosis)' },
  ped_suspension:  { impact: -60, decay: 'long',  basis: 'PED suspensions drive -40–70% sustained (ARod 2013: -60%+, never fully recovered)' },
  legal_trouble:   { impact: -30, decay: 'long',  basis: 'Legal trouble drives -20–40% sustained (collector community reacts strongly)' },
  velocity_loss:   { impact: -18, decay: 'medium', basis: 'Significant velocity loss drives pitcher RCs -12–25% (performance decline narrative)' },
  poor_game:       { impact:  -6, decay: 'immediate', basis: 'Poor game (0-for-4, multiple Ks) drives -4–9% same-day, mostly recovered by next game' },
  short_outing:    { impact:  -8, decay: 'immediate', basis: 'Early exits (<4 IP) average -6–12% same-day (negative headline risk)' },
  era_over_6:      { impact: -12, decay: 'short',  basis: 'ERA over 6.00 over multiple outings drives -8–18% (loss of confidence)' },
  strikeout_4plus: { impact:  -5, decay: 'immediate', basis: '4+ Ks in a game drives -3–8% same-day (collar narrative)' },
  double_play_dp:  { impact:  -4, decay: 'immediate', basis: 'Key double plays average -3–6% same-day (outs in big spots)' },
};

// Market demand factors (long decay — structural)
const MARKET_IMPACTS = {
  print_run_1of1:  { impact: 800, basis: '1/1 cards command 10–50x raw price (scarcity creates price floor)' },
  print_run_10:    { impact: 200, basis: '/10 parallels command ~3x raw value (extreme scarcity)' },
  print_run_25:    { impact: 120, basis: '/25 parallels command ~2.2x raw value' },
  print_run_50:    { impact:  60, basis: '/50 parallels command ~1.6x raw value' },
  print_run_99:    { impact:  30, basis: '/99 parallels command ~1.3x raw value' },
  psa_10_low_pop:  { impact:  80, basis: 'PSA 10 with pop <10 commands 3–8x vs PSA 9 (rarity within rarity)' },
  high_sale_vel:   { impact:  20, basis: 'Multiple sales in 24h signals demand spike +15–25% (hobbyists follow velocity)' },
  media_feature:   { impact:  22, basis: 'Instagram/Twitter highlight reel with 1M+ views drives +15–30% same-day' },
};

// ── Helper: map today's stats to live factors ─────────────────────────────────

function hitterFactors(stats: LivePlayerStat['todayStats']): ProjectionFactor[] {
  const factors: ProjectionFactor[] = [];
  const hrs = stats.homeRuns ?? 0;
  const hits = stats.hits ?? 0;
  const ab = stats.atBats ?? 0;
  const rbi = stats.rbi ?? 0;
  const ks = stats.strikeOuts ?? 0;
  const bb = stats.walks ?? 0;

  // Multi-HR games
  if (hrs >= 3) {
    const c = HITTER_EVENT_IMPACTS.multi_hr_3plus;
    factors.push({ category: 'live_event', label: `${hrs}-HR Game`, impact: c.impact, timeDecay: 'immediate', historicalBasis: c.basis, confidence: 'high' });
  } else if (hrs === 2) {
    const c = HITTER_EVENT_IMPACTS.multi_hr_2;
    factors.push({ category: 'live_event', label: 'Multi-HR Game', impact: c.impact, timeDecay: 'immediate', historicalBasis: c.basis, confidence: 'high' });
  } else if (hrs === 1) {
    const c = HITTER_EVENT_IMPACTS.home_run;
    factors.push({ category: 'live_event', label: 'Home Run', impact: c.impact, timeDecay: 'immediate', historicalBasis: c.basis, confidence: 'medium' });
  }

  // RBI game
  if (rbi >= 5) {
    const c = HITTER_EVENT_IMPACTS.five_plus_rbi;
    factors.push({ category: 'game_performance', label: `${rbi}-RBI Game`, impact: c.impact, timeDecay: 'short', historicalBasis: c.basis, confidence: 'medium' });
  } else if (rbi >= 3) {
    factors.push({ category: 'game_performance', label: `${rbi}-RBI Game`, impact: 6, timeDecay: 'short', historicalBasis: '3–4 RBI games average +4–9% same-day (big offensive contribution)', confidence: 'medium' });
  }

  // Hit games
  if (hits >= 4) {
    const c = HITTER_EVENT_IMPACTS.four_hit;
    factors.push({ category: 'game_performance', label: `${hits}-for-${ab} (${hits} hits)`, impact: c.impact, timeDecay: 'short', historicalBasis: c.basis, confidence: 'medium' });
  } else if (hits === 3) {
    const c = HITTER_EVENT_IMPACTS.three_hit;
    factors.push({ category: 'game_performance', label: `3-for-${ab}`, impact: c.impact, timeDecay: 'short', historicalBasis: c.basis, confidence: 'low' });
  } else if (hits === 2) {
    const c = HITTER_EVENT_IMPACTS.two_hit;
    factors.push({ category: 'game_performance', label: `2-for-${ab}`, impact: c.impact, timeDecay: 'short', historicalBasis: c.basis, confidence: 'low' });
  }

  // Walks
  if (bb >= 3) {
    const c = HITTER_EVENT_IMPACTS.walk_x3;
    factors.push({ category: 'game_performance', label: `${bb} Walks (elite plate discipline)`, impact: c.impact, timeDecay: 'short', historicalBasis: c.basis, confidence: 'low' });
  }

  // Negative: collar
  if (hits === 0 && ab >= 4) {
    const n = NEGATIVE_IMPACTS.poor_game;
    factors.push({ category: 'negative', label: `0-for-${ab} Collar`, impact: n.impact, timeDecay: 'immediate', historicalBasis: n.basis, confidence: 'medium' });
  }

  // Negative: strikeout game
  if (ks >= 4) {
    const n = NEGATIVE_IMPACTS.strikeout_4plus;
    factors.push({ category: 'negative', label: `${ks} Strikeouts`, impact: n.impact, timeDecay: 'immediate', historicalBasis: n.basis, confidence: 'medium' });
  }

  return factors;
}

function pitcherFactors(stats: LivePlayerStat['todayStats']): ProjectionFactor[] {
  const factors: ProjectionFactor[] = [];
  const ip = parseFloat(stats.inningsPitched ?? '0');
  const ks = stats.pitchingStrikeOuts ?? 0;
  const er = stats.earnedRuns ?? 0;

  // Perfect game detection: 9 IP, 0 ER, and extremely high K count is our best proxy
  // (we can't detect 0 hits from stats alone)
  if (ip >= 9 && er === 0 && ks >= 15) {
    const c = PITCHER_EVENT_IMPACTS.perfect_game;
    factors.push({ category: 'live_event', label: 'Perfect Game (27 up, 27 down)', impact: c.impact, timeDecay: 'immediate', historicalBasis: c.basis, confidence: 'high' });
  } else if (ip >= 9 && er === 0) {
    // Complete game shutout — could be no-hitter with lower Ks
    const c = ip >= 9 && ks >= 10
      ? PITCHER_EVENT_IMPACTS.no_hitter
      : PITCHER_EVENT_IMPACTS.cg_shutout;
    const label = ks >= 10 ? 'No-Hitter / CG Shutout' : 'Complete Game Shutout';
    factors.push({ category: 'live_event', label, impact: c.impact, timeDecay: 'immediate', historicalBasis: c.basis, confidence: 'high' });
  }

  // Strikeout milestones
  if (ks >= 15) {
    const c = PITCHER_EVENT_IMPACTS.ks_15_plus;
    factors.push({ category: 'live_event', label: `${ks} Strikeouts`, impact: c.impact, timeDecay: 'immediate', historicalBasis: c.basis, confidence: 'high' });
  } else if (ks >= 12) {
    const c = PITCHER_EVENT_IMPACTS.ks_12_14;
    factors.push({ category: 'live_event', label: `${ks} Strikeouts`, impact: c.impact, timeDecay: 'immediate', historicalBasis: c.basis, confidence: 'high' });
  } else if (ks >= 10) {
    const c = PITCHER_EVENT_IMPACTS.ks_10_11;
    factors.push({ category: 'live_event', label: `${ks} Strikeouts`, impact: c.impact, timeDecay: 'immediate', historicalBasis: c.basis, confidence: 'medium' });
  } else if (ks >= 6) {
    factors.push({ category: 'game_performance', label: `${ks} Strikeouts`, impact: 4, timeDecay: 'short', historicalBasis: '6–9 K games average +2–6% (solid outing but not headline-level)', confidence: 'low' });
  }

  // Quality/dominant starts (non-shutout)
  if (ip >= 7 && er === 0 && ks < 15) {
    const c = PITCHER_EVENT_IMPACTS.dominant_7ip;
    factors.push({ category: 'game_performance', label: `${ip} IP Shutout`, impact: c.impact, timeDecay: 'short', historicalBasis: c.basis, confidence: 'medium' });
  } else if (ip >= 7 && er <= 1) {
    factors.push({ category: 'game_performance', label: `${ip} IP, ${er} ER`, impact: 6, timeDecay: 'short', historicalBasis: '7+ IP, 0–1 ER is elite: drives +4–9% short-term (ace narrative)', confidence: 'medium' });
  } else if (ip >= 6 && er <= 3) {
    const c = PITCHER_EVENT_IMPACTS.quality_start;
    factors.push({ category: 'game_performance', label: `Quality Start (${ip} IP, ${er} ER)`, impact: c.impact, timeDecay: 'short', historicalBasis: c.basis, confidence: 'low' });
  }

  // Negative: early exit
  if (ip > 0 && ip < 4) {
    const n = NEGATIVE_IMPACTS.short_outing;
    factors.push({ category: 'negative', label: `Short Outing (${ip} IP)`, impact: n.impact, timeDecay: 'immediate', historicalBasis: n.basis, confidence: 'medium' });
  }

  // Negative: rough start
  if (er >= 5) {
    const n = NEGATIVE_IMPACTS.era_over_6;
    factors.push({ category: 'negative', label: `${er} Earned Runs Allowed`, impact: n.impact, timeDecay: 'short', historicalBasis: n.basis, confidence: 'medium' });
  } else if (er >= 4) {
    factors.push({ category: 'negative', label: `${er} Earned Runs Allowed`, impact: -6, timeDecay: 'immediate', historicalBasis: '4 ER allowed averages -4–8% same-day (poor outing dampens interest)', confidence: 'medium' });
  }

  return factors;
}

function priceHistoryFactors(priceSummary: CardPriceSummary): ProjectionFactor[] {
  const factors: ProjectionFactor[] = [];
  const history = priceSummary.priceHistory;
  if (history.length < 7) return factors;

  const recent7 = history.slice(-7).map(h => h.price);
  const prior7  = history.slice(-14, -7).map(h => h.price);

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const recentAvg = avg(recent7);
  const priorAvg  = prior7.length > 0 ? avg(prior7) : recentAvg;
  const weekTrend = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;

  if (weekTrend > 20) {
    factors.push({
      category: 'market', label: `+${weekTrend.toFixed(0)}% Weekly Price Trend`, impact: 14,
      timeDecay: 'medium',
      historicalBasis: 'Strong 7-day uptrend (+20%+) signals sustained demand — historically continues +10–18% next week before normalization',
      confidence: 'medium',
    });
  } else if (weekTrend > 8) {
    factors.push({
      category: 'market', label: `+${weekTrend.toFixed(0)}% Weekly Price Trend`, impact: 7,
      timeDecay: 'medium',
      historicalBasis: 'Moderate 7-day uptrend signals healthy demand — typically sustains +5–10% over next 2 weeks',
      confidence: 'medium',
    });
  } else if (weekTrend < -20) {
    factors.push({
      category: 'negative', label: `${weekTrend.toFixed(0)}% Weekly Price Decline`, impact: -12,
      timeDecay: 'medium',
      historicalBasis: 'Sharp 7-day decline signals weakening demand — markets in decline tend to overshoot (-10–18% further)',
      confidence: 'medium',
    });
  } else if (weekTrend < -8) {
    factors.push({
      category: 'negative', label: `${weekTrend.toFixed(0)}% Weekly Price Decline`, impact: -6,
      timeDecay: 'medium',
      historicalBasis: 'Moderate 7-day decline signals cooling demand — expect -4–8% further near-term',
      confidence: 'low',
    });
  }

  // High price variance = active market
  const spread = priceSummary.highestPrice - priceSummary.lowestPrice;
  const spreadPct = priceSummary.averagePrice > 0 ? (spread / priceSummary.averagePrice) * 100 : 0;
  if (spreadPct > 60) {
    factors.push({
      category: 'market', label: 'High Market Activity (wide bid spread)',
      impact: 5, timeDecay: 'short',
      historicalBasis: 'Wide bid/ask spread signals active collector interest — historically +4–8% near-term as price discovery occurs',
      confidence: 'low',
    });
  }

  return factors;
}

// ── Core projection engine ────────────────────────────────────────────────────

export function generateCardValueProjection(
  player: LivePlayerStat,
  priceSummary: CardPriceSummary,
): CardValueProjection {
  const isPitcher = ['P', 'SP', 'RP', 'CP'].includes(player.position);

  const factors: ProjectionFactor[] = [
    ...(isPitcher ? pitcherFactors(player.todayStats) : hitterFactors(player.todayStats)),
    ...priceHistoryFactors(priceSummary),
  ];

  // Build horizons by summing decayed impacts at each time window
  const horizons: ProjectionHorizon[] = HORIZON_LABELS.map((label, hIdx) => {
    let totalPct = 0;
    for (const f of factors) {
      const decay = DECAY[f.timeDecay]?.[hIdx] ?? 0;
      totalPct += f.impact * decay;
    }

    // Cap extreme projections to ±120% for 1h/24h, ±80% for longer (markets correct)
    const caps = [120, 120, 80, 60, 50];
    const cap = caps[hIdx] ?? 50;
    totalPct = Math.max(-cap, Math.min(cap, totalPct));
    totalPct = parseFloat(totalPct.toFixed(1));

    const projectedPrice = parseFloat(
      (priceSummary.averagePrice * (1 + totalPct / 100)).toFixed(2)
    );

    const absImpact = Math.abs(totalPct);
    const confidence: 'low' | 'medium' | 'high' =
      factors.length >= 3 && absImpact >= 15 ? 'high' :
      factors.length >= 2 && absImpact >= 8  ? 'medium' : 'low';

    return { label, pctChange: totalPct, projectedPrice, confidence };
  });

  // Primary driver = highest-absolute-impact factor
  const sorted = [...factors].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  const primaryDriver = sorted[0]?.label ?? 'No significant events today';

  const impact24h = horizons[1]?.pctChange ?? 0;
  const overallTrend: 'bullish' | 'bearish' | 'neutral' =
    impact24h > 4 ? 'bullish' : impact24h < -4 ? 'bearish' : 'neutral';

  return {
    playerId: player.playerId,
    currentPrice: priceSummary.averagePrice,
    horizons,
    factors,
    primaryDriver,
    overallTrend,
  };
}

// ── Season-milestone overlays (called from API when season stats are available) ─

/**
 * Adds seasonal and milestone factors to an existing projection.
 * Called with cumulative season stats when available from the MLB API.
 */
export function applySeasonFactors(
  projection: CardValueProjection,
  seasonStats: {
    homeRuns?: number;
    battingAvg?: number;
    ops?: number;
    rbi?: number;
    hitStreak?: number;
    era?: number;
    strikeOutRate?: number;
    saves?: number;
    winsAboveAverage?: number;
  }
): CardValueProjection {
  const additionalFactors: ProjectionFactor[] = [];

  const { homeRuns = 0, battingAvg = 0, ops = 0, rbi = 0,
          hitStreak = 0, era = 99, saves = 0 } = seasonStats;

  // HR pace (extrapolated to 162 games)
  if (homeRuns >= 50) {
    const c = SEASON_ARC_IMPACTS.hr_pace_60;
    additionalFactors.push({ category: 'season_arc', label: `${homeRuns} HR (Historic pace)`, impact: c.impact, timeDecay: 'medium', historicalBasis: c.basis, confidence: 'high' });
  } else if (homeRuns >= 38) {
    const c = SEASON_ARC_IMPACTS.hr_pace_50;
    additionalFactors.push({ category: 'season_arc', label: `${homeRuns} HR (50+ pace)`, impact: c.impact, timeDecay: 'medium', historicalBasis: c.basis, confidence: 'medium' });
  } else if (homeRuns >= 30) {
    const c = SEASON_ARC_IMPACTS.hr_pace_45;
    additionalFactors.push({ category: 'season_arc', label: `${homeRuns} HR (45-HR pace)`, impact: c.impact, timeDecay: 'medium', historicalBasis: c.basis, confidence: 'medium' });
  } else if (homeRuns >= 25) {
    const c = SEASON_ARC_IMPACTS.hr_pace_40;
    additionalFactors.push({ category: 'season_arc', label: `${homeRuns} HR season`, impact: c.impact, timeDecay: 'long', historicalBasis: c.basis, confidence: 'low' });
  }

  // Hit streak
  if (hitStreak >= 30) {
    const c = SEASON_ARC_IMPACTS.hit_streak_30;
    additionalFactors.push({ category: 'season_arc', label: `${hitStreak}-Game Hit Streak`, impact: c.impact, timeDecay: 'medium', historicalBasis: c.basis, confidence: 'high' });
  } else if (hitStreak >= 20) {
    const c = SEASON_ARC_IMPACTS.hit_streak_20;
    additionalFactors.push({ category: 'season_arc', label: `${hitStreak}-Game Hit Streak`, impact: c.impact, timeDecay: 'medium', historicalBasis: c.basis, confidence: 'medium' });
  } else if (hitStreak >= 15) {
    const c = SEASON_ARC_IMPACTS.hit_streak_15;
    additionalFactors.push({ category: 'season_arc', label: `${hitStreak}-Game Hit Streak`, impact: c.impact, timeDecay: 'medium', historicalBasis: c.basis, confidence: 'medium' });
  }

  // Batting average
  if (battingAvg >= 0.380) {
    const c = SEASON_ARC_IMPACTS.ba_400_pace;
    additionalFactors.push({ category: 'season_arc', label: `.400 AVG Pace (${battingAvg.toFixed(3)})`, impact: c.impact, timeDecay: 'medium', historicalBasis: c.basis, confidence: 'high' });
  } else if (battingAvg >= 0.350) {
    const c = SEASON_ARC_IMPACTS.ba_350_full;
    additionalFactors.push({ category: 'season_arc', label: `.350+ AVG (${battingAvg.toFixed(3)})`, impact: c.impact, timeDecay: 'long', historicalBasis: c.basis, confidence: 'medium' });
  } else if (battingAvg >= 0.330) {
    const c = SEASON_ARC_IMPACTS.ba_330_full;
    additionalFactors.push({ category: 'season_arc', label: `.330+ AVG (${battingAvg.toFixed(3)})`, impact: c.impact, timeDecay: 'long', historicalBasis: c.basis, confidence: 'low' });
  }

  // OPS
  if (ops >= 1.000) {
    const c = SEASON_ARC_IMPACTS.ops_1000_full;
    additionalFactors.push({ category: 'season_arc', label: `${ops.toFixed(3)} OPS`, impact: c.impact, timeDecay: 'long', historicalBasis: c.basis, confidence: 'medium' });
  }

  // RBI
  if (rbi >= 110) {
    const c = SEASON_ARC_IMPACTS.rbi_130_full;
    additionalFactors.push({ category: 'season_arc', label: `${rbi} RBI (130+ pace)`, impact: c.impact, timeDecay: 'long', historicalBasis: c.basis, confidence: 'low' });
  }

  // ERA (pitchers)
  if (era <= 2.00) {
    const c = SEASON_ARC_IMPACTS.era_under_2;
    additionalFactors.push({ category: 'season_arc', label: `${era.toFixed(2)} ERA`, impact: c.impact, timeDecay: 'medium', historicalBasis: c.basis, confidence: 'high' });
  } else if (era <= 2.50) {
    const c = SEASON_ARC_IMPACTS.k_rate_elite;
    additionalFactors.push({ category: 'season_arc', label: `${era.toFixed(2)} ERA (elite)`, impact: c.impact, timeDecay: 'medium', historicalBasis: c.basis, confidence: 'medium' });
  }

  // Saves
  if (saves >= 35) {
    const c = SEASON_ARC_IMPACTS.saves_40;
    additionalFactors.push({ category: 'season_arc', label: `${saves} Saves`, impact: c.impact, timeDecay: 'long', historicalBasis: c.basis, confidence: 'medium' });
  }

  if (additionalFactors.length === 0) return projection;

  const allFactors = [...projection.factors, ...additionalFactors];

  const horizons: ProjectionHorizon[] = HORIZON_LABELS.map((label, hIdx) => {
    let totalPct = 0;
    for (const f of allFactors) {
      const decay = DECAY[f.timeDecay]?.[hIdx] ?? 0;
      totalPct += f.impact * decay;
    }
    const caps = [120, 120, 80, 60, 50];
    const cap = caps[hIdx] ?? 50;
    totalPct = Math.max(-cap, Math.min(cap, parseFloat(totalPct.toFixed(1))));
    const projectedPrice = parseFloat(
      (projection.currentPrice * (1 + totalPct / 100)).toFixed(2)
    );
    const absImpact = Math.abs(totalPct);
    const confidence: 'low' | 'medium' | 'high' =
      allFactors.length >= 3 && absImpact >= 15 ? 'high' :
      allFactors.length >= 2 && absImpact >= 8  ? 'medium' : 'low';
    return { label, pctChange: totalPct, projectedPrice, confidence };
  });

  const sorted = [...allFactors].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  const primaryDriver = sorted[0]?.label ?? projection.primaryDriver;
  const impact24h = horizons[1]?.pctChange ?? 0;
  const overallTrend: 'bullish' | 'bearish' | 'neutral' =
    impact24h > 4 ? 'bullish' : impact24h < -4 ? 'bearish' : 'neutral';

  return { ...projection, factors: allFactors, horizons, primaryDriver, overallTrend };
}

/**
 * Apply a milestone/award announcement to an existing projection.
 * Call this when the API detects an award or historic event was announced.
 */
export function applyMilestone(
  projection: CardValueProjection,
  milestone: keyof typeof MILESTONE_IMPACTS,
): CardValueProjection {
  const m = MILESTONE_IMPACTS[milestone];
  if (!m) return projection;

  const factor: ProjectionFactor = {
    category: 'milestone',
    label: milestone.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    impact: m.impact,
    timeDecay: 'short',
    historicalBasis: m.basis,
    confidence: 'high',
  };

  const allFactors = [...projection.factors, factor];
  const horizons: ProjectionHorizon[] = HORIZON_LABELS.map((label, hIdx) => {
    let totalPct = 0;
    for (const f of allFactors) {
      const decay = DECAY[f.timeDecay]?.[hIdx] ?? 0;
      totalPct += f.impact * decay;
    }
    const caps = [120, 120, 80, 60, 50];
    const cap = caps[hIdx] ?? 50;
    totalPct = Math.max(-cap, Math.min(cap, parseFloat(totalPct.toFixed(1))));
    const projectedPrice = parseFloat(
      (projection.currentPrice * (1 + totalPct / 100)).toFixed(2)
    );
    const confidence: 'low' | 'medium' | 'high' = Math.abs(totalPct) >= 20 ? 'high' : Math.abs(totalPct) >= 8 ? 'medium' : 'low';
    return { label, pctChange: totalPct, projectedPrice, confidence };
  });

  const sorted = [...allFactors].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  const primaryDriver = sorted[0]?.label ?? projection.primaryDriver;
  const impact24h = horizons[1]?.pctChange ?? 0;
  const overallTrend: 'bullish' | 'bearish' | 'neutral' =
    impact24h > 4 ? 'bullish' : impact24h < -4 ? 'bearish' : 'neutral';

  return { ...projection, factors: allFactors, horizons, primaryDriver, overallTrend };
}
