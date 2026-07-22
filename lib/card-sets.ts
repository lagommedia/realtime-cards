interface SetDef { name: string; start: number; end: number; }

const SETS: SetDef[] = [
  // ── Topps base ──
  { name: 'Topps',                      start: 1952, end: 2001 },
  { name: 'Topps Series 1',             start: 2002, end: 9999 },
  { name: 'Topps Series 2',             start: 2002, end: 9999 },
  { name: 'Topps Update',               start: 1988, end: 9999 },
  // ── Topps Chrome ──
  { name: 'Topps Chrome',               start: 1996, end: 9999 },
  { name: 'Topps Chrome Update',        start: 2010, end: 9999 },
  { name: 'Topps Chrome Black',         start: 2020, end: 9999 },
  // ── Topps specialty ──
  { name: 'Topps Heritage',             start: 2001, end: 9999 },
  { name: 'Topps Allen & Ginter',       start: 2006, end: 9999 },
  { name: 'Topps Gypsy Queen',          start: 2011, end: 9999 },
  { name: 'Topps Stadium Club',         start: 1991, end: 9999 },
  { name: 'Topps Finest',               start: 1993, end: 9999 },
  { name: 'Topps Gold Label',           start: 1998, end: 9999 },
  { name: 'Topps Gallery',              start: 1994, end: 9999 },
  { name: 'Topps Tribute',              start: 2010, end: 9999 },
  { name: 'Topps Triple Threads',       start: 2006, end: 9999 },
  { name: 'Topps Transcendent',         start: 2016, end: 9999 },
  { name: 'Topps Now',                  start: 2015, end: 9999 },
  { name: 'Topps Tier One',             start: 2011, end: 9999 },
  { name: 'Topps Stars',                start: 1999, end: 2006 },
  { name: 'Topps 206',                  start: 2009, end: 2011 },
  // ── Bowman ──
  { name: 'Bowman',                     start: 1989, end: 9999 },
  { name: 'Bowman Chrome',              start: 1997, end: 9999 },
  { name: 'Bowman Draft',               start: 2009, end: 9999 },
  { name: "Bowman's Best",              start: 1994, end: 9999 },
  { name: 'Bowman Platinum',            start: 2010, end: 9999 },
  { name: 'Bowman Sterling',            start: 2004, end: 9999 },
  { name: 'Bowman Inception',           start: 2013, end: 9999 },
  { name: 'Bowman Ultra-Prospects',     start: 2022, end: 9999 },
  // ── Upper Deck ──
  { name: 'Upper Deck',                 start: 1989, end: 2009 },
  { name: 'Upper Deck SP Authentic',    start: 1993, end: 2009 },
  { name: 'Upper Deck Exquisite',       start: 2003, end: 2009 },
  { name: 'Upper Deck SPx',             start: 1996, end: 2009 },
  { name: 'Upper Deck SP Game Used',    start: 1996, end: 2009 },
  // ── Fleer ──
  { name: 'Fleer',                      start: 1981, end: 2007 },
  { name: 'Fleer Ultra',                start: 1991, end: 2007 },
  { name: 'Fleer Tradition',            start: 1999, end: 2007 },
  // ── Donruss / Panini ──
  { name: 'Donruss',                    start: 1981, end: 2003 },
  { name: 'Panini Donruss',             start: 2014, end: 2022 },
  { name: 'Panini Prizm',               start: 2012, end: 2022 },
  { name: 'Panini Mosaic',              start: 2019, end: 2022 },
  { name: 'Panini Chronicles',          start: 2019, end: 2022 },
  { name: 'Panini Diamond Kings',       start: 2014, end: 2022 },
  { name: 'Panini National Treasures',  start: 2012, end: 2022 },
  { name: 'Panini Contenders',          start: 2014, end: 2022 },
  { name: 'Panini Select',              start: 2018, end: 2022 },
  // ── Score ──
  { name: 'Score',                      start: 1988, end: 1998 },
  // ── Pacific ──
  { name: 'Pacific',                    start: 1988, end: 2001 },
  // ── O-Pee-Chee ──
  { name: 'O-Pee-Chee',                start: 1965, end: 9999 },
  // ── Leaf / SkyBox / other vintage ──
  { name: 'Leaf',                       start: 1948, end: 9999 },
  { name: 'SkyBox',                     start: 1993, end: 2000 },
  { name: 'Stadium Club',               start: 1991, end: 9999 },
];

export function getSetsForYear(year: number): string[] {
  return SETS
    .filter(s => year >= s.start && year <= s.end)
    .map(s => s.name)
    .sort((a, b) => a.localeCompare(b));
}
