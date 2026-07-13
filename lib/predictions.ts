import { CardPrediction, LivePlayerStat, CardPriceSummary, RookieCardOption, GameEvent } from '@/types';
import { generateCardValueProjection, applySeasonFactors } from '@/lib/card-value-model';

type DateWindow = 'day' | 'week' | 'month' | 'season';

// Maps each date window to the appropriate projection horizon index
// horizons: [1h, 24h, 7d, 30d, season-end]
const WINDOW_HORIZON: Record<DateWindow, number> = {
  day:    1,  // 24h
  week:   2,  // 7d
  month:  3,  // 30d
  season: 4,  // season-end
};

// Price premium of each set relative to Series 1 base price
export const SET_PRICE_MULTIPLIERS: Record<string, number> = {
  'Topps Series 1':  1.0,
  'Topps Series 2':  0.85,
  'Topps Update':    0.9,
  'Topps Chrome':    2.8,
  'Bowman':          1.0,
  'Bowman 1st':      1.5,
  'Bowman Chrome':   2.5,
  'Bowman Chrome 1st': 3.5,
};

export function getRookieCardOptions(_playerId: number, debutYear: number | undefined): RookieCardOption[] {
  const year = debutYear ?? new Date().getFullYear() - 1;
  return [
    { year, set: 'Topps Series 1', shortName: 'S1' },
    { year, set: 'Topps Series 2', shortName: 'S2' },
    { year, set: 'Topps Update',   shortName: 'Update' },
    { year, set: 'Topps Chrome',   shortName: 'Chrome' },
  ];
}

interface ScoringFactors {
  score: number;
  reasons: string[];
}

function scoreBattingPerformance(stats: LivePlayerStat['todayStats']): ScoringFactors {
  let score = 0;
  const reasons: string[] = [];

  if (stats.homeRuns && stats.homeRuns > 0) {
    score += stats.homeRuns * 25;
    reasons.push(`${stats.homeRuns} HR today (+${stats.homeRuns * 25}pts)`);
  }
  if (stats.hits && stats.atBats) {
    const avgToday = stats.hits / stats.atBats;
    if (avgToday >= 0.5) { score += 20; reasons.push('Hot: 50%+ batting avg today (+20pts)'); }
    else if (avgToday >= 0.333) { score += 10; reasons.push('Solid batting performance (+10pts)'); }
    else if (avgToday === 0 && stats.atBats >= 3) { score -= 15; reasons.push('0-for-3+ collar (-15pts)'); }
  }
  if (stats.rbi && stats.rbi > 0) {
    score += stats.rbi * 8;
    reasons.push(`${stats.rbi} RBI today (+${stats.rbi * 8}pts)`);
  }
  if (stats.walks && stats.walks >= 2) {
    score += 5;
    reasons.push('Multiple walks today (+5pts)');
  }
  if (stats.strikeOuts && stats.strikeOuts >= 3) {
    score -= 10;
    reasons.push(`${stats.strikeOuts} strikeouts (-10pts)`);
  }
  return { score, reasons };
}

function scorePitchingPerformance(stats: LivePlayerStat['todayStats']): ScoringFactors {
  let score = 0;
  const reasons: string[] = [];

  if (stats.inningsPitched) {
    const ip = parseFloat(stats.inningsPitched);
    if (ip >= 7) { score += 30; reasons.push(`${ip} IP quality start (+30pts)`); }
    else if (ip >= 6) { score += 20; reasons.push(`${ip} IP solid outing (+20pts)`); }
    else if (ip < 4 && ip > 0) { score -= 20; reasons.push(`Short ${ip} IP outing (-20pts)`); }
  }
  if (stats.pitchingStrikeOuts && stats.pitchingStrikeOuts > 0) {
    const k = stats.pitchingStrikeOuts;
    score += Math.min(k * 4, 24);
    reasons.push(`${k} strikeouts (+${Math.min(k * 4, 24)}pts)`);
  }
  if (stats.earnedRuns !== undefined) {
    if (stats.earnedRuns === 0) { score += 15; reasons.push('Shutout performance (+15pts)'); }
    else if (stats.earnedRuns >= 4) { score -= 20; reasons.push(`${stats.earnedRuns} ER allowed (-20pts)`); }
    else { score -= stats.earnedRuns * 5; reasons.push(`${stats.earnedRuns} ER allowed (-${stats.earnedRuns * 5}pts)`); }
  }
  return { score, reasons };
}

function scorePriceHistory(priceSummary: CardPriceSummary): ScoringFactors {
  let score = 0;
  const reasons: string[] = [];

  const history = priceSummary.priceHistory;
  if (history.length >= 7) {
    const recent = history.slice(-7).map(h => h.price);
    const older = history.slice(-14, -7).map(h => h.price);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const trend = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (trend > 15) { score += 20; reasons.push(`Cards up ${trend.toFixed(1)}% past week (+20pts)`); }
    else if (trend > 5) { score += 10; reasons.push(`Cards up ${trend.toFixed(1)}% past week (+10pts)`); }
    else if (trend < -15) { score -= 20; reasons.push(`Cards down ${Math.abs(trend).toFixed(1)}% past week (-20pts)`); }
    else if (trend < -5) { score -= 10; reasons.push(`Cards down ${Math.abs(trend).toFixed(1)}% past week (-10pts)`); }
  }

  const spread = priceSummary.highestPrice - priceSummary.lowestPrice;
  const spreadPct = (spread / priceSummary.averagePrice) * 100;
  if (spreadPct > 50) {
    score += 5;
    reasons.push('High price variance — market interest (+5pts)');
  }

  return { score, reasons };
}

export function generateCardPrediction(
  player: LivePlayerStat,
  priceSummary: CardPriceSummary,
  window: DateWindow = 'day',
  gameEvents?: GameEvent[],
): CardPrediction {
  const isPitcher = ['P', 'SP', 'RP', 'CP'].includes(player.position);
  const currentPrice = priceSummary.averagePrice;
  const { score: priceScore, reasons: priceReasons } = scorePriceHistory(priceSummary);

  let projection;
  let reasons: string[];

  if (window === 'season') {
    // Season: skip single-game scoring — use cumulative season arc factors instead
    const emptyStatPlayer = { ...player, todayStats: {} };
    const base = generateCardValueProjection(emptyStatPlayer, priceSummary);
    projection = applySeasonFactors(base, {
      homeRuns: player.todayStats.homeRuns,
      rbi:      player.todayStats.rbi,
    });

    // Generate season-appropriate reasons
    const seasonReasons: string[] = [];
    const hrs = player.todayStats.homeRuns ?? 0;
    const rbi = player.todayStats.rbi ?? 0;
    const ks  = player.todayStats.pitchingStrikeOuts ?? 0;
    if (hrs >= 50) seasonReasons.push(`${hrs} HRs — historic pace this season`);
    else if (hrs >= 35) seasonReasons.push(`${hrs} HRs — elite power season`);
    else if (hrs >= 20) seasonReasons.push(`${hrs} HRs on the season`);
    if (rbi >= 100) seasonReasons.push(`${rbi} RBI — elite run production`);
    else if (rbi >= 70) seasonReasons.push(`${rbi} RBI on the season`);
    if (ks >= 200) seasonReasons.push(`${ks} Ks — Cy Young-caliber season`);
    else if (ks >= 150) seasonReasons.push(`${ks} strikeouts on the season`);
    reasons = [...seasonReasons, ...priceReasons];
  } else {
    // Day / Week / Month: use aggregated stats-based scoring
    const { score: perfScore, reasons: perfReasons } = isPitcher
      ? scorePitchingPerformance(player.todayStats)
      : scoreBattingPerformance(player.todayStats);

    const totalScore = Math.max(-100, Math.min(100, perfScore + priceScore));
    projection = generateCardValueProjection(player, priceSummary);

    const windowLabel = window === 'week' ? 'past week' : window === 'month' ? 'past month' : 'today';
    // Rewrite "today" labels to match the date window
    reasons = [
      ...perfReasons.map(r => r.replace('today', windowLabel)),
      ...priceReasons,
    ];
    if (reasons.length === 0) reasons = [`Limited game data available`];
    void totalScore; // used implicitly via projection
  }

  const horizonIdx = WINDOW_HORIZON[window] ?? 1;
  const horizon = projection.horizons[horizonIdx];
  const fallbackPct = parseFloat((priceScore * 0.35).toFixed(1));
  const finalPct = parseFloat((horizon?.pctChange ?? fallbackPct).toFixed(1));
  const finalProjectedPrice = parseFloat((currentPrice * (1 + finalPct / 100)).toFixed(2));
  const finalDirection: 'up' | 'down' | 'neutral' =
    finalPct > 1 ? 'up' : finalPct < -1 ? 'down' : 'neutral';
  const finalConfidence = horizon?.confidence ?? 'low';

  const totalScore = Math.max(-100, Math.min(100,
    (isPitcher ? scorePitchingPerformance(player.todayStats) : scoreBattingPerformance(player.todayStats)).score + priceScore
  ));

  return {
    playerId:        player.playerId,
    playerName:      player.playerName,
    teamId:          player.teamId,
    position:        player.position,
    battingOrder:    player.battingOrder,
    predictionScore: totalScore,
    direction:       finalDirection,
    percentageChange: finalPct,
    confidence:      finalConfidence,
    reasons:         reasons.length > 0 ? reasons : ['Limited game data available'],
    currentPrice,
    projectedPrice:  finalProjectedPrice,
    liveStats:       player.todayStats,
    priceSummary,
    rookieCardOptions: getRookieCardOptions(player.playerId, player.debutYear),
    projection,
    gameEvents:  gameEvents?.length ? gameEvents : undefined,
    dateWindow:  window,
  };
}

export function generateTrendingPredictions(players: LivePlayerStat[]): LivePlayerStat[] {
  return players
    .map(p => {
      const isPitcher = ['P', 'SP', 'RP', 'CP'].includes(p.position);
      let score = 0;
      if (!isPitcher) {
        score += (p.todayStats.homeRuns ?? 0) * 25;
        score += (p.todayStats.hits ?? 0) * 5;
        score += (p.todayStats.rbi ?? 0) * 8;
      } else {
        const ip = parseFloat(p.todayStats.inningsPitched ?? '0');
        score += ip * 4;
        score += (p.todayStats.pitchingStrikeOuts ?? 0) * 4;
        score -= (p.todayStats.earnedRuns ?? 0) * 5;
      }
      return { ...p, _trendScore: score };
    })
    .sort((a, b) => (b as typeof b & { _trendScore: number })._trendScore - (a as typeof a & { _trendScore: number })._trendScore)
    .slice(0, 20);
}
