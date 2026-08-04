/**
 * Generates the standard set of card search queries to track for a given
 * MLB player. These map directly to The Card API `q` parameter.
 *
 * We track PSA 10 for all players (most liquid grade) and add PSA 9 as a
 * lower-cost tier. Each query becomes a row in card_price_history over time.
 */

export interface TrackedCardQuery {
  cardQuery: string;
  grade: string;
  cardSet: string;
  year: number;
}

const SETS: Array<{ label: string; template: (name: string, year: number) => string }> = [
  { label: 'Topps Chrome',   template: (n, y) => `${n} ${y} Topps Chrome`   },
  { label: 'Topps Update',   template: (n, y) => `${n} ${y} Topps Update`   },
  { label: 'Bowman Chrome',  template: (n, y) => `${n} ${y} Bowman Chrome`  },
  { label: 'Topps Series 1', template: (n, y) => `${n} ${y} Topps`          },
];

const GRADES = ['PSA 10', 'PSA 9'];

export function getCardQueriesForPlayer(
  playerName: string,
  debutYear: number,
): TrackedCardQuery[] {
  const queries: TrackedCardQuery[] = [];

  for (const set of SETS) {
    for (const grade of GRADES) {
      const base = set.template(playerName, debutYear);
      queries.push({
        cardQuery: `${base} ${grade}`,
        grade,
        cardSet: set.label,
        year: debutYear,
      });
    }
  }

  return queries;
}
