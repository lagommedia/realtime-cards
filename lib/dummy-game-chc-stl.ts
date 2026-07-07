/**
 * Dummy live game — Chicago Cubs (112) vs St. Louis Cardinals (138)
 * Simulated state: Top of the 6th, CHC 4 – STL 2, 1 out
 */

import { CardPrediction, LivePlayerStat, CardPriceSummary } from '@/types';
import { getRookieCardOptions } from '@/lib/predictions';
import { generateCardValueProjection } from '@/lib/card-value-model';

export const DUMMY_GAME_ID = 'chc-stl-live';

export interface Pitch {
  seq: number;
  x: number;    // 0–1, horizontal (0 = catcher's left / RHH outside, 1 = catcher's right / RHH inside)
  y: number;    // 0–1, vertical (0 = low, 1 = high)
  result: 'ball' | 'called_strike' | 'swinging_strike' | 'foul';
  velocity?: number; // mph
  pitchType?: string; // e.g. 'FF', 'SL', 'CH'
}

export interface LiveMatchup {
  batterId: number;
  pitcherId: number;
  batter: {
    name: string;
    number: string;
    seasonAvg: string;
    atBatsToday: number;
    hitsToday: number;
  };
  pitcher: {
    name: string;
    number: string;
    seasonEra: string;
    pitchCount: number;
    balls: number;
    strikes: number;
  };
  bases: { first: boolean; second: boolean; third: boolean };
  pitches: Pitch[];
  lastResult?: { event: string; batterName: string };
}

export const DUMMY_GAME_META = {
  gamePk: 99001,
  isLive: true,
  inning: '▲ 6th',
  inningHalf: 'Top' as 'Top' | 'Bottom',
  outs: 1,
  awayTeam: { id: 112, name: 'Chicago Cubs',       abbreviation: 'CHC', score: 4 },
  homeTeam: { id: 138, name: 'St. Louis Cardinals', abbreviation: 'STL', score: 2 },
  // Dansby Swanson at the plate vs Hayden Wesneski on the mound
  // Runner on 1st and 2nd — 1 out, full count
  liveMatchup: {
    batterId: 621020,
    pitcherId: 694378,
    batter: {
      name: 'Dansby Swanson',
      number: '7',
      seasonAvg: '.248',
      atBatsToday: 3,
      hitsToday: 0,
    },
    pitcher: {
      name: 'H. Wesneski',
      number: '47',
      seasonEra: '3.54',
      pitchCount: 14,
      balls: 3,
      strikes: 2,
    },
    bases: { first: true, second: true, third: false },
    // 5-pitch at-bat: CS (0-1) B (1-1) SS (1-2) B (2-2) B (3-2 full count)
    pitches: [
      { seq: 1, x: 0.60, y: 0.55, result: 'called_strike',  velocity: 94, pitchType: 'FF' },
      { seq: 2, x: 0.75, y: 0.10, result: 'ball',           velocity: 87, pitchType: 'CH' },
      { seq: 3, x: 0.68, y: 0.32, result: 'swinging_strike',velocity: 88, pitchType: 'SL' },
      { seq: 4, x: 0.22, y: 0.84, result: 'ball',           velocity: 96, pitchType: 'FF' },
      { seq: 5, x: 0.78, y: 0.16, result: 'ball',           velocity: 82, pitchType: 'CU' },
    ],
  } satisfies LiveMatchup,
};

// ── Roster definitions ────────────────────────────────────────────────────────

interface RosterEntry {
  playerId: number;
  playerName: string;
  teamId: number;
  position: string;
  battingOrder?: number; // 1–9 for starters; undefined for bench/pen
  isPitcher: boolean;
  debutYear: number;
  basePrice: number;
  stats: Record<string, number | string>;
  direction: 'up' | 'down' | 'neutral';
  percentageChange: number;
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
}

const CUBS_ROSTER: RosterEntry[] = [
  {
    playerId: 663538, playerName: 'Nico Hoerner',          teamId: 112, position: '2B', battingOrder: 1,
    isPitcher: false, debutYear: 2019, basePrice: 28.00,
    stats: { atBats: 3, hits: 1, homeRuns: 0, rbi: 0, strikeOuts: 0, walks: 1 },
    direction: 'up', percentageChange: 5.2, confidence: 'medium',
    reasons: ['On-base twice (+8pts)', 'Line-drive single (+5pts)', 'Steady table-setter narrative'],
  },
  {
    playerId: 664023, playerName: 'Ian Happ',              teamId: 112, position: 'LF', battingOrder: 2,
    isPitcher: false, debutYear: 2017, basePrice: 34.00,
    stats: { atBats: 3, hits: 2, homeRuns: 1, rbi: 2, strikeOuts: 0, walks: 0 },
    direction: 'up', percentageChange: 18.4, confidence: 'high',
    reasons: ['Home run + 2 RBI (+40pts)', '2-for-3 at the plate (+10pts)', 'Cards up 9% past week (+10pts)'],
  },
  {
    playerId: 641355, playerName: 'Cody Bellinger',        teamId: 112, position: 'CF', battingOrder: 3,
    isPitcher: false, debutYear: 2017, basePrice: 55.00,
    stats: { atBats: 3, hits: 1, homeRuns: 0, rbi: 1, strikeOuts: 1, walks: 0 },
    direction: 'up', percentageChange: 7.1, confidence: 'medium',
    reasons: ['RBI single (+12pts)', 'Bounce-back performance (+5pts)', 'High-demand Chrome Refractor market'],
  },
  {
    playerId: 621020, playerName: 'Dansby Swanson',        teamId: 112, position: 'SS', battingOrder: 4,
    isPitcher: false, debutYear: 2016, basePrice: 31.00,
    stats: { atBats: 3, hits: 0, homeRuns: 0, rbi: 0, strikeOuts: 2, walks: 0 },
    direction: 'down', percentageChange: -8.5, confidence: 'medium',
    reasons: ['0-for-3, 2 Ks (-18pts)', 'Unproductive in two AB with RISP (-8pts)', 'Short-term demand softer'],
  },
  {
    playerId: 673548, playerName: 'Seiya Suzuki',          teamId: 112, position: 'RF', battingOrder: 5,
    isPitcher: false, debutYear: 2022, basePrice: 62.00,
    stats: { atBats: 3, hits: 2, homeRuns: 0, rbi: 1, strikeOuts: 0, walks: 0 },
    direction: 'up', percentageChange: 11.3, confidence: 'high',
    reasons: ['2-for-3 with a double (+15pts)', 'RBI extra-base hit (+12pts)', 'RC market active this week (+8pts)'],
  },
  {
    playerId: 682998, playerName: 'Christopher Morel',     teamId: 112, position: '3B', battingOrder: 6,
    isPitcher: false, debutYear: 2022, basePrice: 18.00,
    stats: { atBats: 3, hits: 0, homeRuns: 0, rbi: 0, strikeOuts: 2, walks: 0 },
    direction: 'down', percentageChange: -9.2, confidence: 'low',
    reasons: ['0-for-3, 2 Ks (-18pts)', 'Slumping: 1-for-last-10 (-8pts)'],
  },
  {
    playerId: 694943, playerName: 'Michael Busch',         teamId: 112, position: '1B', battingOrder: 7,
    isPitcher: false, debutYear: 2024, basePrice: 45.00,
    stats: { atBats: 2, hits: 1, homeRuns: 0, rbi: 0, strikeOuts: 0, walks: 0 },
    direction: 'up', percentageChange: 6.8, confidence: 'medium',
    reasons: ['Hit safely in 3rd straight game (+10pts)', 'RC demand remains elevated (+8pts)', 'Rookie narrative intact'],
  },
  {
    playerId: 669257, playerName: 'Miguel Amaya',          teamId: 112, position: 'C', battingOrder: 8,
    isPitcher: false, debutYear: 2023, basePrice: 22.00,
    stats: { atBats: 2, hits: 0, homeRuns: 0, rbi: 0, strikeOuts: 1, walks: 0 },
    direction: 'down', percentageChange: -5.1, confidence: 'low',
    reasons: ['0-for-2, K (-8pts)', 'Catching prospect narrative — patience required'],
  },
  {
    playerId: 693588, playerName: 'Pete Crow-Armstrong',   teamId: 112, position: 'CF', battingOrder: 9,
    isPitcher: false, debutYear: 2023, basePrice: 52.00,
    stats: { atBats: 2, hits: 1, homeRuns: 0, rbi: 0, strikeOuts: 0, walks: 0 },
    direction: 'up', percentageChange: 8.6, confidence: 'medium',
    reasons: ['Hit in the leadoff spot (+8pts)', 'Hyped RC market (+10pts)', 'Top prospect premium'],
  },
  // Pitchers
  {
    playerId: 672515, playerName: 'Justin Steele',         teamId: 112, position: 'SP', battingOrder: undefined,
    isPitcher: true, debutYear: 2021, basePrice: 24.00,
    stats: { inningsPitched: '5.1', pitchingStrikeOuts: 7, earnedRuns: 2, walks: 1 },
    direction: 'up', percentageChange: 14.2, confidence: 'high',
    reasons: ['7 Ks through 5.1 IP (+20pts)', 'Quality start in progress (+14pts)', 'Limiting damage despite 2 ER'],
  },
  {
    playerId: 694378, playerName: 'Hayden Wesneski',       teamId: 112, position: 'RP', battingOrder: undefined,
    isPitcher: true, debutYear: 2022, basePrice: 12.00,
    stats: { inningsPitched: '0.2', pitchingStrikeOuts: 1, earnedRuns: 0, walks: 0 },
    direction: 'up', percentageChange: 4.5, confidence: 'low',
    reasons: ['Clean 0.2 IP relief appearance (+5pts)', 'Bridge guy narrative'],
  },
  {
    playerId: 666201, playerName: 'Adbert Alzolay',        teamId: 112, position: 'RP', battingOrder: undefined,
    isPitcher: true, debutYear: 2019, basePrice: 10.00,
    stats: { inningsPitched: '0.0', pitchingStrikeOuts: 0, earnedRuns: 0, walks: 0 },
    direction: 'neutral', percentageChange: 0.5, confidence: 'low',
    reasons: ['Warming in the bullpen — no action yet'],
  },
];

const CARDINALS_ROSTER: RosterEntry[] = [
  {
    playerId: 669357, playerName: 'Nolan Gorman',          teamId: 138, position: '2B', battingOrder: 1,
    isPitcher: false, debutYear: 2022, basePrice: 38.00,
    stats: { atBats: 2, hits: 0, homeRuns: 0, rbi: 0, strikeOuts: 1, walks: 1 },
    direction: 'down', percentageChange: -4.2, confidence: 'low',
    reasons: ['0-for-2, K (-8pts)', 'Walk salvages some plate approach (+3pts)', 'Market cooling on second-year players'],
  },
  {
    playerId: 571448, playerName: 'Nolan Arenado',         teamId: 138, position: '3B', battingOrder: 2,
    isPitcher: false, debutYear: 2013, basePrice: 48.00,
    stats: { atBats: 3, hits: 2, homeRuns: 1, rbi: 2, strikeOuts: 0, walks: 0 },
    direction: 'up', percentageChange: 16.8, confidence: 'high',
    reasons: ['Solo HR + RBI double (+36pts)', '2-for-3, multi-RBI day (+12pts)', 'Vet premium on Chrome autos'],
  },
  {
    playerId: 502671, playerName: 'Paul Goldschmidt',      teamId: 138, position: '1B', battingOrder: 3,
    isPitcher: false, debutYear: 2011, basePrice: 36.00,
    stats: { atBats: 3, hits: 1, homeRuns: 0, rbi: 0, strikeOuts: 1, walks: 0 },
    direction: 'neutral', percentageChange: 1.8, confidence: 'low',
    reasons: ['1-for-3, quiet night so far (+2pts)', 'Veteran steady demand'],
  },
  {
    playerId: 575929, playerName: 'Willson Contreras',     teamId: 138, position: 'C', battingOrder: 4,
    isPitcher: false, debutYear: 2016, basePrice: 28.00,
    stats: { atBats: 3, hits: 1, homeRuns: 0, rbi: 1, strikeOuts: 0, walks: 0 },
    direction: 'up', percentageChange: 5.9, confidence: 'medium',
    reasons: ['RBI single (+12pts)', 'Calling a good game behind the plate', 'Cards stable, light buying interest'],
  },
  {
    playerId: 694192, playerName: 'Jordan Walker',         teamId: 138, position: 'RF', battingOrder: 5,
    isPitcher: false, debutYear: 2023, basePrice: 68.00,
    stats: { atBats: 3, hits: 0, homeRuns: 0, rbi: 0, strikeOuts: 2, walks: 0 },
    direction: 'down', percentageChange: -11.4, confidence: 'high',
    reasons: ['0-for-3, 2 Ks (-20pts)', 'RC market reacting to slump (-10pts)', 'Cards down 6% past week (-8pts)'],
  },
  {
    playerId: 669134, playerName: 'Lars Nootbaar',         teamId: 138, position: 'LF', battingOrder: 6,
    isPitcher: false, debutYear: 2021, basePrice: 20.00,
    stats: { atBats: 3, hits: 1, homeRuns: 0, rbi: 0, strikeOuts: 0, walks: 0 },
    direction: 'up', percentageChange: 4.1, confidence: 'low',
    reasons: ['Hit safely (+5pts)', 'International market demand a factor (+4pts)'],
  },
  {
    playerId: 680543, playerName: 'Brendan Donovan',       teamId: 138, position: 'DH', battingOrder: 7,
    isPitcher: false, debutYear: 2022, basePrice: 15.00,
    stats: { atBats: 2, hits: 0, homeRuns: 0, rbi: 0, strikeOuts: 0, walks: 1 },
    direction: 'neutral', percentageChange: -1.2, confidence: 'low',
    reasons: ['0-for-2, drew a walk (+2pts)', 'Limited card market activity'],
  },
  {
    playerId: 657557, playerName: 'Paul DeJong',           teamId: 138, position: 'SS', battingOrder: 8,
    isPitcher: false, debutYear: 2017, basePrice: 12.00,
    stats: { atBats: 2, hits: 1, homeRuns: 0, rbi: 0, strikeOuts: 0, walks: 0 },
    direction: 'up', percentageChange: 5.5, confidence: 'low',
    reasons: ['Hit safely (+5pts)', 'Veteran bench-value card market'],
  },
  {
    playerId: 666818, playerName: 'Dylan Carlson',         teamId: 138, position: 'CF', battingOrder: 9,
    isPitcher: false, debutYear: 2020, basePrice: 16.00,
    stats: { atBats: 2, hits: 0, homeRuns: 0, rbi: 0, strikeOuts: 1, walks: 0 },
    direction: 'down', percentageChange: -6.2, confidence: 'low',
    reasons: ['0-for-2, K (-8pts)', 'Struggling to stay in lineup narrative (-5pts)'],
  },
  // Pitchers
  {
    playerId: 571945, playerName: 'Miles Mikolas',         teamId: 138, position: 'SP', battingOrder: undefined,
    isPitcher: true, debutYear: 2012, basePrice: 16.00,
    stats: { inningsPitched: '4.0', pitchingStrikeOuts: 3, earnedRuns: 4, walks: 1 },
    direction: 'down', percentageChange: -18.5, confidence: 'high',
    reasons: ['4 ER in 4 IP — rough outing (-32pts)', 'Pulled early, bullpen exposed (-12pts)', 'Cards down sharply on performance'],
  },
  {
    playerId: 685953, playerName: 'Andre Pallante',        teamId: 138, position: 'RP', battingOrder: undefined,
    isPitcher: true, debutYear: 2022, basePrice: 11.00,
    stats: { inningsPitched: '1.0', pitchingStrikeOuts: 1, earnedRuns: 0, walks: 0 },
    direction: 'up', percentageChange: 5.8, confidence: 'low',
    reasons: ['1.0 IP, 0 ER, 1 K (+8pts)', 'Solid middle-relief appearance'],
  },
  {
    playerId: 676909, playerName: 'Ryan Helsley',          teamId: 138, position: 'CL', battingOrder: undefined,
    isPitcher: true, debutYear: 2019, basePrice: 22.00,
    stats: { inningsPitched: '0.0', pitchingStrikeOuts: 0, earnedRuns: 0, walks: 0 },
    direction: 'up', percentageChange: 3.2, confidence: 'low',
    reasons: ['Closing opportunity in a tight game (+8pts)', 'Closer narrative premium'],
  },
];

// ── Builder ───────────────────────────────────────────────────────────────────

function buildPriceHistory(basePrice: number, direction: 'up' | 'down' | 'neutral') {
  const history: { date: string; price: number }[] = [];
  const now = new Date();
  const trend = direction === 'up' ? -0.08 : direction === 'down' ? 0.08 : 0;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const t = (29 - i) / 29;
    const noise = (Math.random() - 0.5) * 0.06 * basePrice;
    history.push({
      date: d.toISOString().split('T')[0],
      price: Math.max(1, parseFloat((basePrice * (1 + trend * (1 - t)) + noise).toFixed(2))),
    });
  }
  return history;
}

function buildPredictions(roster: RosterEntry[]): CardPrediction[] {
  return roster.map(p => {
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

    const priceHistory = buildPriceHistory(p.basePrice, p.direction);

    const mockListing = {
      itemId: `game-${p.playerId}`,
      title: `${p.playerName} Baseball Card`,
      price: p.basePrice,
      currency: 'USD',
      condition: 'Near Mint',
      itemUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(p.playerName + ' baseball card')}&_sacat=212`,
    };

    const priceSummary: CardPriceSummary = {
      playerId: p.playerId,
      playerName: p.playerName,
      averagePrice: p.basePrice,
      lowestPrice: parseFloat((p.basePrice * 0.72).toFixed(2)),
      highestPrice: parseFloat((p.basePrice * 1.65).toFixed(2)),
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
    const dir: 'up' | 'down' | 'neutral' = pct > 1 ? 'up' : pct < -1 ? 'down' : 'neutral';

    return {
      playerId: p.playerId,
      playerName: p.playerName,
      teamId: p.teamId,
      position: p.position,
      predictionScore: parseFloat((pct * 2.5).toFixed(1)),
      direction: dir,
      percentageChange: parseFloat(pct.toFixed(1)),
      confidence: projection.horizons[1]?.confidence ?? p.confidence,
      reasons: p.reasons,
      currentPrice: p.basePrice,
      projectedPrice: parseFloat((p.basePrice * (1 + pct / 100)).toFixed(2)),
      liveStats,
      priceSummary,
      rookieCardOptions: getRookieCardOptions(p.playerId, p.debutYear),
      projection,
    } satisfies CardPrediction;
  });
}

export function getDummyGamePredictions(): CardPrediction[] {
  return [...buildPredictions(CUBS_ROSTER), ...buildPredictions(CARDINALS_ROSTER)];
}
