/**
 * GET /api/ai-projection/[playerId]/pipeline
 *
 * Assembles the full data payload for a single player:
 *   1. MLB historical game logs + milestone detection (3 seasons)
 *   2. eBay sold-price history bucketed by week (90-day window per set)
 *   3. Milestone × price impact correlations
 *
 * Returns a structured JSON object ready to be sent to Claude for
 * card-value projection analysis. No AI calls happen here — this
 * is the data pipeline only.
 *
 * Query params:
 *   name       — player's full name (required for eBay queries)
 *   rcYear     — rookie card year (falls back to debut year if omitted)
 *
 * Example:
 *   /api/ai-projection/683002/pipeline?name=Gunnar+Henderson&rcYear=2023
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlayerHistoricalStats } from '@/lib/mlb-stats-history';
import { getPlayerCardHistory }     from '@/lib/ebay-history';
import { PIPELINE_SEASONS }         from '@/lib/pipeline-config';
import { PIPELINE_TEST_PLAYERS }    from '@/lib/pipeline-config';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const { playerId: playerIdStr } = await params;
  const playerId = parseInt(playerIdStr, 10);
  if (isNaN(playerId)) {
    return NextResponse.json({ error: 'Invalid playerId' }, { status: 400 });
  }

  // Accept name + rcYear from query params, or fall back to the test-player config
  const searchParams = req.nextUrl.searchParams;
  const configPlayer = PIPELINE_TEST_PLAYERS.find(p => p.playerId === playerId);

  const playerName = searchParams.get('name') ?? configPlayer?.name ?? '';
  const rcYear     = parseInt(searchParams.get('rcYear') ?? '0', 10) || configPlayer?.debutYear;

  if (!playerName) {
    return NextResponse.json(
      { error: 'Provide ?name=Player+Name (and optionally ?rcYear=YYYY)' },
      { status: 400 },
    );
  }

  const startMs = Date.now();

  // Step 1: MLB historical stats + milestone detection
  const mlbStats = await getPlayerHistoricalStats(playerId, PIPELINE_SEASONS);

  const effectiveRcYear = rcYear ?? mlbStats.debutYear;

  // Step 2: eBay sold history + milestone price correlation
  const cardHistory = await getPlayerCardHistory(
    playerName,
    effectiveRcYear,
    mlbStats.allMilestones,
  );

  const elapsedMs = Date.now() - startMs;

  // Step 3: Assemble the Claude-ready payload
  const payload = {
    meta: {
      playerId,
      playerName: mlbStats.playerName || playerName,
      isPitcher: mlbStats.isPitcher,
      debutYear: mlbStats.debutYear,
      rcYear: effectiveRcYear,
      pipelineRunMs: elapsedMs,
      generatedAt: new Date().toISOString(),
    },
    seasonSummaries: mlbStats.seasons.map(s => ({
      year: s.year,
      gamesPlayed: s.gamesPlayed,
      milestoneCount: s.milestones.length,
      // Hitting
      ...(s.hits       !== undefined && { hits:         s.hits       }),
      ...(s.homeRuns   !== undefined && { homeRuns:     s.homeRuns   }),
      ...(s.rbi        !== undefined && { rbi:          s.rbi        }),
      ...(s.stolenBases !== undefined && { stolenBases: s.stolenBases }),
      ...(s.battingAvg !== undefined && { battingAvg:   s.battingAvg }),
      // Pitching
      ...(s.era              !== undefined && { era:              s.era              }),
      ...(s.wins             !== undefined && { wins:             s.wins             }),
      ...(s.strikeOutsPitching !== undefined && { strikeOutsPitching: s.strikeOutsPitching }),
      ...(s.inningsPitched   !== undefined && { inningsPitched:   s.inningsPitched   }),
    })),
    milestones: mlbStats.allMilestones,
    cardPriceHistory: cardHistory.sets,
    milestoneImpacts: cardHistory.milestoneImpacts.filter(
      // Only include impacts where we have at least baseline or post data
      m => m.baseline30dAvg !== null || m.post7dAvg !== null,
    ),
    // Summary counts for quick review
    summary: {
      totalMilestones:      mlbStats.allMilestones.length,
      milestoneBreakdown:   countByType(mlbStats.allMilestones),
      setsWithPriceData:    cardHistory.sets.length,
      totalSoldListings:    cardHistory.sets.reduce((n, s) => n + s.rawListingCount, 0),
      impactsWithData:      cardHistory.milestoneImpacts.filter(m => m.pctChange7d !== null).length,
    },
  };

  return NextResponse.json(payload);
}

function countByType(milestones: Array<{ type: string }>): Record<string, number> {
  return milestones.reduce<Record<string, number>>((acc, m) => {
    acc[m.type] = (acc[m.type] ?? 0) + 1;
    return acc;
  }, {});
}
