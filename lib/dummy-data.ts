import { CardPrediction, LivePlayerStat, CardPriceSummary } from '@/types';
import { getRookieCardOptions } from '@/lib/predictions';
import { generateCardValueProjection } from '@/lib/card-value-model';

// Real MLB player IDs and team IDs for dummy/preview data
const DUMMY_PLAYERS: Array<{
  playerId: number; playerName: string; teamId: number;
  position: string; isPitcher: boolean; debutYear: number;
  stats: Record<string, number | string>;
  basePrice: number; cardType: string;
  direction: 'up' | 'down'; percentageChange: number; confidence: 'low' | 'medium' | 'high';
  reasons: string[];
}> = [
  {
    playerId: 660271, playerName: 'Shohei Ohtani', teamId: 119, position: 'DH', isPitcher: false, debutYear: 2018,
    stats: { atBats: 4, hits: 3, homeRuns: 2, rbi: 4, strikeOuts: 0, walks: 1 },
    basePrice: 185.00, cardType: 'Rookie Card',
    direction: 'up', percentageChange: 28.0, confidence: 'high',
    reasons: ['2 HR today (+50pts)', '4 RBI performance (+32pts)', 'Cards up 12.1% past week (+10pts)', 'Multi-hit game (+10pts)'],
  },
  {
    playerId: 605141, playerName: 'Mookie Betts', teamId: 119, position: 'RF', isPitcher: false, debutYear: 2014,
    stats: { atBats: 5, hits: 3, homeRuns: 1, rbi: 3, strikeOuts: 1, walks: 0 },
    basePrice: 62.50, cardType: 'Chrome Refractor',
    direction: 'up', percentageChange: 18.5, confidence: 'high',
    reasons: ['1 HR today (+25pts)', '3 RBI today (+24pts)', 'Solid 3-for-5 day (+10pts)', 'High price variance — market interest (+5pts)'],
  },
  {
    playerId: 694973, playerName: 'Paul Skenes', teamId: 134, position: 'SP', isPitcher: true, debutYear: 2024,
    stats: { inningsPitched: '7.0', pitchingStrikeOuts: 12, earnedRuns: 0, walks: 1 },
    basePrice: 210.00, cardType: 'Rookie Card',
    direction: 'up', percentageChange: 32.5, confidence: 'high',
    reasons: ['12 K dominant outing (+24pts)', '7 IP quality start (+30pts)', 'Shutout performance (+15pts)', 'Cards up 18.4% past week (+20pts)'],
  },
  {
    playerId: 683002, playerName: 'Gunnar Henderson', teamId: 110, position: 'SS', isPitcher: false, debutYear: 2022,
    stats: { atBats: 4, hits: 2, homeRuns: 1, rbi: 2, strikeOuts: 1, walks: 1 },
    basePrice: 95.00, cardType: 'Rookie Card',
    direction: 'up', percentageChange: 14.0, confidence: 'medium',
    reasons: ['1 HR today (+25pts)', '2 RBI today (+16pts)', 'Cards up 6.8% past week (+10pts)'],
  },
  {
    playerId: 677951, playerName: 'Bobby Witt Jr.', teamId: 118, position: 'SS', isPitcher: false, debutYear: 2022,
    stats: { atBats: 5, hits: 4, homeRuns: 1, rbi: 3, strikeOuts: 0, walks: 0 },
    basePrice: 88.00, cardType: 'Rookie Card',
    direction: 'up', percentageChange: 21.0, confidence: 'high',
    reasons: ['4 hits — hot streak (+20pts)', '1 HR today (+25pts)', '3 RBI today (+24pts)', 'Hot: 80%+ batting avg today (+20pts)'],
  },
  {
    playerId: 677594, playerName: 'Julio Rodriguez', teamId: 136, position: 'CF', isPitcher: false, debutYear: 2022,
    stats: { atBats: 4, hits: 1, homeRuns: 0, rbi: 0, strikeOuts: 2, walks: 1 },
    basePrice: 74.00, cardType: 'Rookie Card',
    direction: 'down', percentageChange: -8.5, confidence: 'medium',
    reasons: ['1-for-4 with 2 K (-15pts)', 'Cards down 5.2% past week (-10pts)', 'No RBI or extra bases (-5pts)'],
  },
  {
    playerId: 660670, playerName: 'Ronald Acuña Jr.', teamId: 144, position: 'RF', isPitcher: false, debutYear: 2018,
    stats: { atBats: 4, hits: 2, homeRuns: 0, rbi: 1, strikeOuts: 1, walks: 2 },
    basePrice: 115.00, cardType: 'Chrome Refractor',
    direction: 'up', percentageChange: 9.5, confidence: 'medium',
    reasons: ['2 hits + 2 BB solid game (+15pts)', '1 RBI today (+8pts)', 'High price variance — market interest (+5pts)'],
  },
  {
    playerId: 665487, playerName: 'Fernando Tatis Jr.', teamId: 135, position: 'RF', isPitcher: false, debutYear: 2019,
    stats: { atBats: 4, hits: 0, homeRuns: 0, rbi: 0, strikeOuts: 3, walks: 0 },
    basePrice: 68.00, cardType: 'Rookie Card',
    direction: 'down', percentageChange: -12.5, confidence: 'high',
    reasons: ['0-for-4 with 3 strikeouts (-25pts)', 'Cards down 7.3% past week (-10pts)', 'No production in key spots'],
  },
  {
    playerId: 665742, playerName: 'Juan Soto', teamId: 121, position: 'RF', isPitcher: false, debutYear: 2018,
    stats: { atBats: 3, hits: 2, homeRuns: 1, rbi: 2, strikeOuts: 0, walks: 2 },
    basePrice: 98.00, cardType: 'Gold Parallel',
    direction: 'up', percentageChange: 16.0, confidence: 'high',
    reasons: ['1 HR today (+25pts)', 'Multi-walk discipline (+5pts)', '2 RBI today (+16pts)', 'Cards up 9.1% past week (+10pts)'],
  },
  {
    playerId: 518692, playerName: 'Freddie Freeman', teamId: 119, position: '1B', isPitcher: false, debutYear: 2010,
    stats: { atBats: 5, hits: 2, homeRuns: 0, rbi: 1, strikeOuts: 1, walks: 0 },
    basePrice: 42.00, cardType: 'Topps Base',
    direction: 'up', percentageChange: 5.5, confidence: 'low',
    reasons: ['2 hits today (+10pts)', '1 RBI (+8pts)', 'High price variance — market interest (+5pts)'],
  },
  {
    playerId: 675911, playerName: 'Spencer Strider', teamId: 144, position: 'SP', isPitcher: true, debutYear: 2022,
    stats: { inningsPitched: '5.1', pitchingStrikeOuts: 9, earnedRuns: 3, walks: 2 },
    basePrice: 55.00, cardType: 'Chrome Refractor',
    direction: 'down', percentageChange: -9.0, confidence: 'medium',
    reasons: ['3 ER allowed (-15pts)', 'Didn\'t finish 6th inning (-20pts)', 'Cards down 4.8% past week (-10pts)'],
  },
  {
    playerId: 543037, playerName: 'Gerrit Cole', teamId: 147, position: 'SP', isPitcher: true, debutYear: 2013,
    stats: { inningsPitched: '6.0', pitchingStrikeOuts: 8, earnedRuns: 1, walks: 1 },
    basePrice: 38.00, cardType: 'Topps Base',
    direction: 'up', percentageChange: 11.0, confidence: 'medium',
    reasons: ['8 K outing (+24pts)', '6 IP quality start (+20pts)', '1 ER solid control (+10pts)', 'Cards up 5.6% past week (+10pts)'],
  },
];

function buildPriceHistory(basePrice: number, direction: 'up' | 'down') {
  const history = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const trend = direction === 'up' ? (i / 29) * -0.08 : (i / 29) * 0.08;
    const noise = (Math.random() - 0.5) * 0.06 * basePrice;
    history.push({
      date: d.toISOString().split('T')[0],
      price: Math.max(1, parseFloat((basePrice * (1 + trend) + noise).toFixed(2))),
    });
  }
  return history;
}

export function getDummyTrendingPredictions(): CardPrediction[] {
  return DUMMY_PLAYERS.map(p => {
    const priceHistory = buildPriceHistory(p.basePrice, p.direction);

    const mockListing = {
      itemId: `mock-${p.playerId}`,
      title: `${p.playerName} 2024 Topps ${p.cardType === 'Rookie Card' ? 'Update Series RC' : p.cardType} Baseball Card`,
      price: p.basePrice,
      currency: 'USD',
      condition: 'Near Mint',
      itemUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(p.playerName + ' baseball card')}&_sacat=212`,
    };

    const liveStats: LivePlayerStat['todayStats'] = p.isPitcher
      ? {
          inningsPitched: p.stats.inningsPitched as string,
          pitchingStrikeOuts: p.stats.pitchingStrikeOuts as number,
          earnedRuns: p.stats.earnedRuns as number,
          walks: p.stats.walks as number,
        }
      : {
          atBats: p.stats.atBats as number,
          hits: p.stats.hits as number,
          homeRuns: p.stats.homeRuns as number,
          rbi: p.stats.rbi as number,
          strikeOuts: p.stats.strikeOuts as number,
          walks: p.stats.walks as number,
        };

    const priceSummary: CardPriceSummary = {
      playerId: p.playerId,
      playerName: p.playerName,
      averagePrice: p.basePrice,
      lowestPrice: parseFloat((p.basePrice * 0.75).toFixed(2)),
      highestPrice: parseFloat((p.basePrice * 1.6).toFixed(2)),
      recentSales: [mockListing],
      activeListing: mockListing,
      priceHistory,
    };

    const playerStat: LivePlayerStat = {
      playerId: p.playerId,
      playerName: p.playerName,
      teamId: p.teamId,
      position: p.position,
      debutYear: p.debutYear,
      todayStats: liveStats,
    };

    const projection = generateCardValueProjection(playerStat, priceSummary);
    const pct = projection.horizons[1]?.pctChange ?? p.percentageChange;
    const projectedPrice = parseFloat((p.basePrice * (1 + pct / 100)).toFixed(2));
    const direction: 'up' | 'down' | 'neutral' = pct > 1 ? 'up' : pct < -1 ? 'down' : 'neutral';

    return {
      playerId: p.playerId,
      playerName: p.playerName,
      teamId: p.teamId,
      position: p.position,
      predictionScore: p.direction === 'up' ? p.percentageChange * 2.5 : p.percentageChange * 2.5,
      direction,
      percentageChange: parseFloat(pct.toFixed(1)),
      confidence: projection.horizons[1]?.confidence ?? p.confidence,
      reasons: p.reasons,
      currentPrice: p.basePrice,
      projectedPrice,
      liveStats,
      priceSummary,
      rookieCardOptions: getRookieCardOptions(p.debutYear),
      projection,
    } satisfies CardPrediction;
  });
}
