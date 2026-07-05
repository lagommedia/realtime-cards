// ESPN abbreviations differ from MLB abbreviations in a few cases
const ESPN_ABBREV: Record<number, string> = {
  110: 'bal',  // Baltimore Orioles
  111: 'bos',  // Boston Red Sox
  147: 'nyy',  // New York Yankees
  139: 'tb',   // Tampa Bay Rays
  141: 'tor',  // Toronto Blue Jays
  145: 'chw',  // Chicago White Sox (ESPN uses chw, not cws)
  114: 'cle',  // Cleveland Guardians
  116: 'det',  // Detroit Tigers
  118: 'kc',   // Kansas City Royals
  142: 'min',  // Minnesota Twins
  117: 'hou',  // Houston Astros
  108: 'laa',  // Los Angeles Angels
  133: 'oak',  // Oakland Athletics
  136: 'sea',  // Seattle Mariners
  140: 'tex',  // Texas Rangers
  144: 'atl',  // Atlanta Braves
  146: 'mia',  // Miami Marlins
  121: 'nym',  // New York Mets
  143: 'phi',  // Philadelphia Phillies
  120: 'wsh',  // Washington Nationals
  112: 'chc',  // Chicago Cubs
  113: 'cin',  // Cincinnati Reds
  158: 'mil',  // Milwaukee Brewers
  134: 'pit',  // Pittsburgh Pirates
  138: 'stl',  // St. Louis Cardinals
  109: 'ari',  // Arizona Diamondbacks
  115: 'col',  // Colorado Rockies
  119: 'lad',  // Los Angeles Dodgers
  135: 'sd',   // San Diego Padres
  137: 'sf',   // San Francisco Giants
};

export function getTeamLogoUrl(teamId: number): string {
  const abbrev = ESPN_ABBREV[teamId];
  if (!abbrev) return '';
  return `https://a.espncdn.com/i/teamlogos/mlb/500/${abbrev}.png`;
}
