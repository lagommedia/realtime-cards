export interface FlagshipRC {
  year: number;
  set: string;       // Full set name used in eBay queries, e.g. "Topps Update"
  shortName: string; // Display abbreviation, e.g. "Update"
}

/**
 * Curated map of MLB player ID → their specific flagship Topps Rookie Card.
 * Covers the most actively traded active and recently retired players.
 * Extend this map as new players establish their flagship RC.
 *
 * Rules used to determine flagship:
 *  - The first Topps base set where the player appeared with official RC status
 *  - RC status requires <130 career MLB plate appearances (or 50 IP for pitchers)
 *    at the time the set was printed
 *  - Series 1 prints ~February, Series 2 ~July, Update ~October of the same year
 */
export const FLAGSHIP_RC: Record<number, FlagshipRC> = {
  // ── All-time greats still active ──────────────────────────────────────────
  545361: { year: 2011, set: 'Topps Update', shortName: 'Update' },      // Mike Trout
  477132: { year: 2008, set: 'Topps Series 1', shortName: 'S1' },        // Clayton Kershaw
  518692: { year: 2011, set: 'Topps Update', shortName: 'Update' },      // Freddie Freeman
  571448: { year: 2013, set: 'Topps Update', shortName: 'Update' },      // Nolan Arenado
  543037: { year: 2013, set: 'Topps Update', shortName: 'Update' },      // Gerrit Cole
  594798: { year: 2014, set: 'Topps Update', shortName: 'Update' },      // Jacob deGrom
  605141: { year: 2014, set: 'Topps Update', shortName: 'Update' },      // Mookie Betts
  596019: { year: 2015, set: 'Topps Update', shortName: 'Update' },      // Francisco Lindor
  621043: { year: 2015, set: 'Topps Update', shortName: 'Update' },      // Carlos Correa
  608369: { year: 2016, set: 'Topps Update', shortName: 'Update' },      // Corey Seager
  608324: { year: 2016, set: 'Topps Update', shortName: 'Update' },      // Alex Bregman

  // ── 2017 class ────────────────────────────────────────────────────────────
  592450: { year: 2017, set: 'Topps Update', shortName: 'Update' },      // Aaron Judge
  641355: { year: 2017, set: 'Topps Update', shortName: 'Update' },      // Cody Bellinger
  656305: { year: 2017, set: 'Topps Update', shortName: 'Update' },      // Andrew Benintendi

  // ── 2018 class ────────────────────────────────────────────────────────────
  660271: { year: 2018, set: 'Topps Update', shortName: 'Update' },      // Shohei Ohtani
  665742: { year: 2018, set: 'Topps Update', shortName: 'Update' },      // Juan Soto
  660670: { year: 2018, set: 'Topps Update', shortName: 'Update' },      // Ronald Acuña Jr
  645261: { year: 2018, set: 'Topps Update', shortName: 'Update' },      // Sandy Alcantara
  656941: { year: 2018, set: 'Topps Update', shortName: 'Update' },      // Gleyber Torres
  664056: { year: 2018, set: 'Topps Update', shortName: 'Update' },      // Walker Buehler

  // ── 2019 class ────────────────────────────────────────────────────────────
  665487: { year: 2019, set: 'Topps Update', shortName: 'Update' },      // Fernando Tatis Jr
  665489: { year: 2019, set: 'Topps Update', shortName: 'Update' },      // Vladimir Guerrero Jr
  666182: { year: 2019, set: 'Topps Update', shortName: 'Update' },      // Bo Bichette
  624413: { year: 2019, set: 'Topps Update', shortName: 'Update' },      // Pete Alonso
  663586: { year: 2019, set: 'Topps Update', shortName: 'Update' },      // Austin Riley
  670541: { year: 2019, set: 'Topps Update', shortName: 'Update' },      // Yordan Alvarez
  669203: { year: 2019, set: 'Topps Update', shortName: 'Update' },      // Corbin Burnes
  669016: { year: 2019, set: 'Topps Update', shortName: 'Update' },      // Brendan McKay
  669357: { year: 2019, set: 'Topps Update', shortName: 'Update' },      // Bryan Reynolds

  // ── 2020 class ────────────────────────────────────────────────────────────
  668227: { year: 2020, set: 'Topps Update', shortName: 'Update' },      // Randy Arozarena
  663647: { year: 2020, set: 'Topps Update', shortName: 'Update' },      // Ke'Bryan Hayes
  672275: { year: 2020, set: 'Topps Update', shortName: 'Update' },      // Dylan Carlson
  680573: { year: 2020, set: 'Topps Update', shortName: 'Update' },      // Triston McKenzie

  // ── 2021 class ────────────────────────────────────────────────────────────
  679570: { year: 2021, set: 'Topps Update', shortName: 'Update' },      // Wander Franco
  678227: { year: 2021, set: 'Topps Update', shortName: 'Update' },      // Ian Anderson
  676710: { year: 2021, set: 'Topps Update', shortName: 'Update' },      // Jarred Kelenic

  // ── 2022 class ────────────────────────────────────────────────────────────
  677594: { year: 2022, set: 'Topps Update', shortName: 'Update' },      // Julio Rodriguez
  677951: { year: 2022, set: 'Topps Update', shortName: 'Update' },      // Bobby Witt Jr
  668939: { year: 2022, set: 'Topps Update', shortName: 'Update' },      // Adley Rutschman
  686780: { year: 2022, set: 'Topps Update', shortName: 'Update' },      // Jeremy Peña
  675911: { year: 2022, set: 'Topps Update', shortName: 'Update' },      // Spencer Strider
  678882: { year: 2022, set: 'Topps Update', shortName: 'Update' },      // Michael Harris II
  682624: { year: 2022, set: 'Topps Update', shortName: 'Update' },      // Steven Kwan
  681911: { year: 2022, set: 'Topps Update', shortName: 'Update' },      // Framber Valdez (full RC 2022)

  // ── 2023 class ────────────────────────────────────────────────────────────
  683002: { year: 2023, set: 'Topps Series 1', shortName: 'S1' },        // Gunnar Henderson (RC in S1 #285)
  682998: { year: 2023, set: 'Topps Update', shortName: 'Update' },      // Corbin Carroll
  694192: { year: 2023, set: 'Topps Update', shortName: 'Update' },      // Elly De La Cruz
  694001: { year: 2023, set: 'Topps Update', shortName: 'Update' },      // Matt McLain
  694234: { year: 2023, set: 'Topps Update', shortName: 'Update' },      // Evan Carter
  694738: { year: 2023, set: 'Topps Update', shortName: 'Update' },      // Masyn Winn

  // ── 2024 class ────────────────────────────────────────────────────────────
  700338: { year: 2024, set: 'Topps Update', shortName: 'Update' },      // Paul Skenes
  698997: { year: 2024, set: 'Topps Update', shortName: 'Update' },      // Jackson Holliday
  694492: { year: 2024, set: 'Topps Update', shortName: 'Update' },      // Jackson Chourio
  695243: { year: 2024, set: 'Topps Update', shortName: 'Update' },      // Yoshinobu Yamamoto
  693976: { year: 2024, set: 'Topps Update', shortName: 'Update' },      // Wyatt Langford
  694568: { year: 2024, set: 'Topps Update', shortName: 'Update' },      // Junior Caminero
};

/**
 * Returns the flagship RC for a player, or derives a reasonable default
 * from their debut year when no curated entry exists.
 */
export function getFlagshipRC(playerId: number, debutYear?: number): FlagshipRC {
  const known = FLAGSHIP_RC[playerId];
  if (known) return known;
  const year = debutYear ?? new Date().getFullYear();
  return { year, set: 'Topps Update', shortName: 'Update' };
}
