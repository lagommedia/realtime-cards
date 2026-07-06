import { CardPrediction, LivePlayerStat, CardPriceSummary, RookieCardOption } from '@/types';
import { generateCardValueProjection } from '@/lib/card-value-model';

// Only these four Topps sets are shown — Series 1, Series 2, Update, and Chrome
const TOPPS_RC_SETS: Array<{ set: string; shortName: string }> = [
  { set: 'Topps Series 1', shortName: 'Topps S1' },
  { set: 'Topps Series 2', shortName: 'Topps S2' },
  { set: 'Topps Update', shortName: 'Update' },
  { set: 'Topps Chrome', shortName: 'Chrome' },
];

// Price premium of each set relative to Series 1 base price
export const SET_PRICE_MULTIPLIERS: Record<string, number> = {
  'Topps Series 1': 1.0,
  'Topps Series 2': 0.85,
  'Topps Update': 0.9,
  'Topps Chrome': 2.8,
};

export function getRookieCardOptions(debutYear: number | undefined): RookieCardOption[] {
  const year = debutYear ?? new Date().getFullYear();
  return TOPPS_RC_SETS.map(s => ({ year, ...s }));
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
  priceSummary: CardPriceSummary
): CardPrediction {
  const isPitcher = ['P', 'SP', 'RP', 'CP'].includes(player.position);

  const { score: perfScore, reasons: perfReasons } = isPitcher
    ? scorePitchingPerformance(player.todayStats)
    : scoreBattingPerformance(player.todayStats);

  const { score: priceScore, reasons: priceReasons } = scorePriceHistory(priceSummary);

  const totalScore = Math.max(-100, Math.min(100, perfScore + priceScore));
  const reasons = [...perfReasons, ...priceReasons];

  const direction: 'up' | 'down' | 'neutral' =
    totalScore > 5 ? 'up' : totalScore < -5 ? 'down' : 'neutral';

  const percentageChange = parseFloat((totalScore * 0.35).toFixed(1));

  const absScore = Math.abs(totalScore);
  const confidence: 'low' | 'medium' | 'high' =
    absScore >= 40 ? 'high' : absScore >= 20 ? 'medium' : 'low';

  const currentPrice = priceSummary.averagePrice;
  const projectedPrice = parseFloat(
    (currentPrice * (1 + percentageChange / 100)).toFixed(2)
  );

  const projection = generateCardValueProjection(player, priceSummary);

  // Use projection's 24h estimate as the primary percentage change
  const projPct = projection.horizons[1]?.pctChange ?? percentageChange;
  const finalPct = parseFloat(projPct.toFixed(1));
  const finalProjectedPrice = parseFloat(
    (currentPrice * (1 + finalPct / 100)).toFixed(2)
  );
  const finalDirection: 'up' | 'down' | 'neutral' =
    finalPct > 1 ? 'up' : finalPct < -1 ? 'down' : 'neutral';
  const finalConfidence = projection.horizons[1]?.confidence ?? confidence;

  return {
    playerId: player.playerId,
    playerName: player.playerName,
    teamId: player.teamId,
    position: player.position,
    predictionScore: totalScore,
    direction: finalDirection,
    percentageChange: finalPct,
    confidence: finalConfidence,
    reasons: reasons.length > 0 ? reasons : ['Limited game data available'],
    currentPrice,
    projectedPrice: finalProjectedPrice,
    liveStats: player.todayStats,
    priceSummary,
    rookieCardOptions: getRookieCardOptions(player.debutYear),
    projection,
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
