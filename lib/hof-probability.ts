// Hall of Fame probability model.
// Scores a player's projected career against historical HOF benchmarks.
// Returns a 0-100 probability + per-benchmark breakdown.

export type HofBenchmark = {
  label: string;
  current: number;
  projected: number;
  target: number;
  pct: number;       // 0-1 progress toward target
  higherIsBetter: boolean;
  unit: string;
};

export type HofTierKey = 'First Ballot' | 'HOF Contender' | 'Borderline' | 'Fringe' | 'Long Shot';

export type HofResult = {
  probability: number;
  tier: HofTierKey;
  tierColor: string;
  description: string;
  benchmarks: HofBenchmark[];
  yearsRemaining: number;
  isPitcher: boolean;
};

export type RawCareerStats = {
  gamesPlayed: number;
  hits?: number;
  homeRuns?: number;
  rbi?: number;
  avg?: number;
  ops?: number;
  wins?: number;
  era?: number;
  strikeOuts?: number;
  whip?: number;
  inningsPitched?: string | number;
};

const TIERS: { min: number; label: HofTierKey; color: string; desc: string }[] = [
  { min: 78, label: 'First Ballot',   color: '#f59e0b', desc: 'Historic pace. A lock for Cooperstown.' },
  { min: 58, label: 'HOF Contender',  color: '#22c55e', desc: 'Strong credentials building a compelling HOF case.' },
  { min: 38, label: 'Borderline',     color: '#3b82f6', desc: 'On the HOF radar — sustained excellence could get them there.' },
  { min: 18, label: 'Fringe',         color: '#f97316', desc: 'Career would need a significant surge to reach Cooperstown.' },
  { min:  0, label: 'Long Shot',      color: '#6b7280', desc: 'Not currently on a Hall of Fame trajectory.' },
];

export function hofTierFor(probability: number) {
  return TIERS.find(t => probability >= t.min) ?? TIERS[TIERS.length - 1];
}

export function calculateHof(
  career: RawCareerStats,
  age: number,
  debutYear: number,
  isPitcher: boolean,
): HofResult {
  const currentYear = new Date().getFullYear();
  const seasonsPlayed = Math.max(1, currentYear - debutYear + 1);
  const retirementAge = isPitcher ? 37 : 38;
  const yearsRemaining = Math.max(0, retirementAge - age);

  // How much to trust a projection: ramps from 0→1 over the first 7 seasons.
  // Prevents young players with elite rate stats from projecting to First Ballot
  // before they've proven sustained excellence over multiple seasons.
  const credibility = Math.min(1, seasonsPlayed / 7);

  // Per-season pace extrapolated to retirement, scaled by career credibility.
  // Veterans with 7+ seasons get the full bonus; rookies only a fraction.
  function project(careerTotal: number): number {
    const perSeason = careerTotal / seasonsPlayed;
    const rawBonus = perSeason * yearsRemaining * 0.82;
    return Math.round(careerTotal + rawBonus * credibility);
  }

  let score = 0;
  const benchmarks: HofBenchmark[] = [];

  if (!isPitcher) {
    const hit = career.hits ?? 0;
    const hr  = career.homeRuns ?? 0;
    const rbi = career.rbi ?? 0;
    const avg = career.avg ?? 0;
    const ops = career.ops ?? 0;

    const pH  = project(hit);
    const pHR = project(hr);
    const pR  = project(rbi);

    const hitPct = Math.min(pH  / 3000, 1);
    const hrPct  = Math.min(pHR / 500,  1);
    const rbiPct = Math.min(pR  / 1500, 1);
    const avgPct = avg >= 0.300 ? 1 : avg >= 0.285 ? 0.75 : avg >= 0.270 ? 0.50 : avg >= 0.255 ? 0.25 : 0.05;
    const opsPct = ops >= 0.950 ? 1 : ops >= 0.900 ? 0.85 : ops >= 0.850 ? 0.65 : ops >= 0.800 ? 0.40 : ops >= 0.750 ? 0.20 : 0.05;

    // Rate stats need a volume gate: a .300 AVG over 100 games scores differently
    // than a .300 AVG over 1,500 games. Full credit at 700 career games (~4-5 seasons).
    const rateVolume = Math.min(1, (career.gamesPlayed ?? 0) / 700);

    score += hitPct * 26 + hrPct * 22 + rbiPct * 18 + (avgPct * rateVolume) * 18 + (opsPct * rateVolume) * 16;

    benchmarks.push(
      { label: 'Career Hits',   current: hit, projected: pH,  target: 3000,  pct: hitPct, higherIsBetter: true,  unit: '' },
      { label: 'Home Runs',     current: hr,  projected: pHR, target: 500,   pct: hrPct,  higherIsBetter: true,  unit: 'HR' },
      { label: 'RBI',           current: rbi, projected: pR,  target: 1500,  pct: rbiPct, higherIsBetter: true,  unit: 'RBI' },
      { label: 'Career AVG',    current: avg, projected: avg, target: 0.300, pct: avgPct, higherIsBetter: true,  unit: 'AVG' },
      { label: 'Career OPS',    current: ops, projected: ops, target: 0.900, pct: opsPct, higherIsBetter: true,  unit: 'OPS' },
    );
  } else {
    const ks   = career.strikeOuts ?? 0;
    const wins = career.wins ?? 0;
    const era  = isNaN(career.era ?? NaN) ? 9.99 : (career.era ?? 9.99);
    const whip = isNaN(career.whip ?? NaN) ? 2.99 : (career.whip ?? 2.99);
    const ip   = parseFloat(String(career.inningsPitched ?? '0'));

    const pKs   = project(ks);
    const pWins = project(wins);
    const pIP   = project(Math.round(ip));

    const ksPct   = Math.min(pKs   / 3000, 1);
    const winsPct = Math.min(pWins / 250,  1);
    const ipPct   = Math.min(pIP   / 2500, 1);
    // ERA / WHIP: lower is better — score how far below the HOF threshold they are
    const eraPct  = era  <= 2.50 ? 1 : era  <= 3.00 ? 0.82 : era  <= 3.50 ? 0.60 : era  <= 4.00 ? 0.28 : 0.05;
    const whipPct = whip <= 0.95 ? 1 : whip <= 1.10 ? 0.82 : whip <= 1.25 ? 0.60 : whip <= 1.40 ? 0.28 : 0.05;

    // Same volume gate for pitchers: full ERA/WHIP credit requires ~800 IP (~5 seasons).
    // Prevents a dominant 2-year pitcher from scoring the same as a 15-year HOF ace.
    const rateVolume = Math.min(1, ip / 800);

    score += ksPct * 28 + winsPct * 20 + (eraPct * rateVolume) * 20 + (whipPct * rateVolume) * 18 + ipPct * 14;

    benchmarks.push(
      { label: 'Career Strikeouts', current: ks,   projected: pKs,   target: 3000, pct: ksPct,   higherIsBetter: true,  unit: 'K' },
      { label: 'Career Wins',       current: wins,  projected: pWins, target: 250,  pct: winsPct, higherIsBetter: true,  unit: 'W' },
      { label: 'Career ERA',        current: era,   projected: era,   target: 3.50, pct: eraPct,  higherIsBetter: false, unit: 'ERA' },
      { label: 'Career WHIP',       current: whip,  projected: whip,  target: 1.25, pct: whipPct, higherIsBetter: false, unit: 'WHIP' },
      { label: 'Innings Pitched',   current: ip,    projected: pIP,   target: 2500, pct: ipPct,   higherIsBetter: true,  unit: 'IP' },
    );
  }

  // Two-way player boost: if a batter also has substantial pitching innings (e.g. Ohtani),
  // score both sides and blend so the pitching contribution isn't silently ignored.
  if (!isPitcher) {
    const ipNum = parseFloat(String(career.inningsPitched ?? '0'));
    if (ipNum > 200) {
      const ks   = career.strikeOuts ?? 0;
      const wins = career.wins ?? 0;
      const era  = isNaN(career.era ?? NaN) ? 9.99 : (career.era ?? 9.99);
      const whip = isNaN(career.whip ?? NaN) ? 2.99 : (career.whip ?? 2.99);

      const pKs2   = project(ks);
      const pWins2 = project(wins);
      const pIP2   = project(Math.round(ipNum));

      const ksPct2   = Math.min(pKs2   / 3000, 1);
      const winsPct2 = Math.min(pWins2 / 250,  1);
      const ipPct2   = Math.min(pIP2   / 2500, 1);
      const eraPct2  = era  <= 2.50 ? 1 : era  <= 3.00 ? 0.82 : era  <= 3.50 ? 0.60 : era  <= 4.00 ? 0.28 : 0.05;
      const whipPct2 = whip <= 0.95 ? 1 : whip <= 1.10 ? 0.82 : whip <= 1.25 ? 0.60 : whip <= 1.40 ? 0.28 : 0.05;
      const pitchVol = Math.min(1, ipNum / 800);

      const pitchSub = ksPct2 * 28 + winsPct2 * 20 + (eraPct2 * pitchVol) * 20 + (whipPct2 * pitchVol) * 18 + ipPct2 * 14;
      score = Math.min(100, score + pitchSub * 0.55);
    }
  }

  const probability = Math.min(96, Math.max(2, Math.round(score)));
  const tier = hofTierFor(probability);

  return { probability, tier: tier.label, tierColor: tier.color, description: tier.desc, benchmarks, yearsRemaining, isPitcher };
}
