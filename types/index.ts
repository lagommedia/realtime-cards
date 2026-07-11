export interface MLBTeam {
  id: number;
  name: string;
  abbreviation: string;
  locationName: string;
  teamName: string;
}

export interface MLBGame {
  gamePk: number;
  gameDate: string;
  status: {
    abstractGameState: string;
    detailedState: string;
    statusCode: string;
  };
  teams: {
    away: { team: MLBTeam; score?: number; leagueRecord: { wins: number; losses: number } };
    home: { team: MLBTeam; score?: number; leagueRecord: { wins: number; losses: number } };
  };
  venue: { name: string };
  linescore?: {
    currentInning?: number;
    currentInningOrdinal?: string;
    inningHalf?: string;
    outs?: number;
  };
}

export interface MLBPlayer {
  id: number;
  fullName: string;
  primaryNumber?: string;
  currentTeam?: { id: number; name: string };
  primaryPosition?: { name: string; abbreviation: string };
  stats?: PlayerStats;
}

export interface PlayerStats {
  batting?: {
    avg: string;
    homeRuns: number;
    rbi: number;
    hits: number;
    atBats: number;
    strikeOuts: number;
    walks: number;
    ops: string;
    obp: string;
    slg: string;
  };
  pitching?: {
    era: string;
    wins: number;
    losses: number;
    strikeOuts: number;
    walks: number;
    inningsPitched: string;
    whip: string;
  };
}

export interface RookieCardOption {
  year: number;
  set: string;       // e.g. "Topps Series 1"
  shortName: string; // e.g. "Topps S1"
}

export interface SetCardResult {
  set: string;       // "Topps Series 1"
  shortName: string; // "S1"
  year: number;
  binPrice: number | null;   // Ask price of the specific BIN listing shown
  soldPrice: number | null;  // Most recent sold price (reference only)
  soldDate?: string;
  imageUrl?: string;
  itemUrl: string;   // Buy It Now eBay listing URL
}

export interface LivePlayerStat {
  playerId: number;
  playerName: string;
  teamId: number;
  position: string;
  debutYear?: number;
  battingOrder?: number; // 1–9 from MLB boxscore; undefined for pitchers/bench
  todayStats: {
    atBats?: number;
    hits?: number;
    homeRuns?: number;
    rbi?: number;
    strikeOuts?: number;
    walks?: number;
    avg?: string;
    inningsPitched?: string;
    pitchingStrikeOuts?: number;
    earnedRuns?: number;
  };
}

export interface EbayListing {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  condition: string;
  imageUrl?: string;
  itemUrl: string;
  soldDate?: string;
}

export interface CardPriceSummary {
  playerId: number;
  playerName: string;
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  recentSales: EbayListing[];
  activeListing?: EbayListing;
  priceHistory: { date: string; price: number }[];
}

export interface CardPrediction {
  playerId: number;
  playerName: string;
  teamId: number;
  position: string;
  battingOrder?: number;
  predictionScore: number; // -100 to +100
  direction: 'up' | 'down' | 'neutral';
  percentageChange: number;
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
  currentPrice: number;
  projectedPrice: number;
  liveStats: LivePlayerStat['todayStats'];
  priceSummary?: CardPriceSummary;
  rookieCardOptions: RookieCardOption[];
  projection?: CardValueProjection;
}

export interface TrendingPlayer {
  playerId: number;
  playerName: string;
  teamId: number;
  teamName: string;
  position: string;
  trendScore: number;
  direction: 'up' | 'down';
  percentageChange: number;
  currentPrice: number;
  reason: string;
  imageUrl?: string;
}

export interface TeamTheme {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  background: string;
  cardBackground: string;
  gradient: string;
  name: string;
}

// ── Card Value Projection Engine ─────────────────────────────────────────────

export type ProjectionCategory =
  | 'live_event'        // immediate game plays (HR, cycle, no-hitter, etc.)
  | 'game_performance'  // today's line (4-for-4, 5+ RBI, 7 IP 0 ER, etc.)
  | 'season_arc'        // cumulative season stats and pace
  | 'milestone'         // records, awards, streaks
  | 'market'            // PSA pop, print run, sale velocity
  | 'negative';         // injury, suspension, poor performance

export type ProjectionTimeDecay = 'immediate' | 'short' | 'medium' | 'long';

export interface ProjectionFactor {
  category: ProjectionCategory;
  label: string;
  impact: number;              // base % impact (can be negative)
  timeDecay: ProjectionTimeDecay;
  historicalBasis: string;     // e.g. "Cycles drove +20–30% in 24h (Turner 2021)"
  confidence: 'low' | 'medium' | 'high';
}

export interface ProjectionHorizon {
  label: string;               // e.g. "24 hours"
  pctChange: number;
  projectedPrice: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface CardValueProjection {
  playerId: number;
  currentPrice: number;
  horizons: ProjectionHorizon[];  // [1h, 24h, 7d, 30d, season-end]
  factors: ProjectionFactor[];
  primaryDriver: string;
  overallTrend: 'bullish' | 'bearish' | 'neutral';
}
