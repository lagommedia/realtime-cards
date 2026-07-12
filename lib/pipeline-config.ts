/**
 * Test players for the AI projection data pipeline.
 * Chosen for: 2+ seasons of data, active PSA 10 card markets, variety of positions/teams.
 */
export interface PipelinePlayer {
  playerId: number;
  name: string;
  debutYear: number;
}

export const PIPELINE_TEST_PLAYERS: PipelinePlayer[] = [
  { playerId: 683002, name: 'Gunnar Henderson',  debutYear: 2023 }, // BAL SS — Topps Series 1
  { playerId: 677951, name: 'Bobby Witt Jr.',    debutYear: 2022 }, // KC SS  — Topps Update
  { playerId: 694192, name: 'Elly De La Cruz',   debutYear: 2023 }, // CIN SS — Topps Update
  { playerId: 677594, name: 'Julio Rodriguez',   debutYear: 2022 }, // SEA OF — Topps Update
  { playerId: 682998, name: 'Corbin Carroll',    debutYear: 2023 }, // ARI OF — Topps Update
];

/** Seasons to pull game logs for (most recent 3 complete/in-progress seasons). */
export const PIPELINE_SEASONS = [2024, 2025, 2026];
