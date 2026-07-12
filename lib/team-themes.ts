import { TeamTheme } from '@/types';

export const TEAM_THEMES: Record<number, TeamTheme> = {
  // AL East
  110: { // Baltimore Orioles
    primary: '#DF4601', secondary: '#000000', accent: '#DF4601',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-orange-900 to-black', name: 'Baltimore Orioles',
  },
  111: { // Boston Red Sox
    primary: '#BD3039', secondary: '#0C2340', accent: '#BD3039',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-red-900 to-blue-950', name: 'Boston Red Sox',
  },
  147: { // New York Yankees
    primary: '#003087', secondary: '#C4CED4', accent: '#C4CED4',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-blue-950 to-gray-900', name: 'New York Yankees',
  },
  139: { // Tampa Bay Rays
    primary: '#092C5C', secondary: '#8FBCE6', accent: '#F5D130',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-blue-950 to-blue-800', name: 'Tampa Bay Rays',
  },
  141: { // Toronto Blue Jays
    primary: '#134A8E', secondary: '#1D2D5C', accent: '#E8291C',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-blue-900 to-red-900', name: 'Toronto Blue Jays',
  },
  // AL Central
  145: { // Chicago White Sox
    primary: '#27251F', secondary: '#C4CED4', accent: '#FFFFFF',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-gray-900 to-black', name: 'Chicago White Sox',
  },
  114: { // Cleveland Guardians
    primary: '#E31937', secondary: '#002B5C', accent: '#E31937',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-red-900 to-blue-950', name: 'Cleveland Guardians',
  },
  116: { // Detroit Tigers
    primary: '#0C2C56', secondary: '#FA4616', accent: '#FA4616',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-blue-950 to-orange-900', name: 'Detroit Tigers',
  },
  118: { // Kansas City Royals
    primary: '#004687', secondary: '#C09A5B', accent: '#C09A5B',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-blue-900 to-yellow-900', name: 'Kansas City Royals',
  },
  142: { // Minnesota Twins
    primary: '#002B5C', secondary: '#D31145', accent: '#B9975B',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-blue-950 to-red-900', name: 'Minnesota Twins',
  },
  // AL West
  117: { // Houston Astros
    primary: '#002D62', secondary: '#EB6E1F', accent: '#EB6E1F',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-blue-950 to-orange-900', name: 'Houston Astros',
  },
  108: { // Los Angeles Angels
    primary: '#BA0021', secondary: '#003263', accent: '#C4CED4',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-red-950 to-blue-950', name: 'Los Angeles Angels',
  },
  133: { // Oakland Athletics
    primary: '#003831', secondary: '#EFB21E', accent: '#EFB21E',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-green-950 to-yellow-900', name: 'Oakland Athletics',
  },
  136: { // Seattle Mariners
    primary: '#0C2C56', secondary: '#005C5C', accent: '#C4CED4',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-blue-950 to-teal-900', name: 'Seattle Mariners',
  },
  140: { // Texas Rangers
    primary: '#003278', secondary: '#C0111F', accent: '#C4CED4',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-blue-950 to-red-950', name: 'Texas Rangers',
  },
  // NL East
  144: { // Atlanta Braves
    primary: '#CE1141', secondary: '#13274F', accent: '#EAAA00',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-red-900 to-blue-950', name: 'Atlanta Braves',
  },
  146: { // Miami Marlins
    primary: '#00A3E0', secondary: '#FF6600', accent: '#EF3340',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-blue-900 to-orange-900', name: 'Miami Marlins',
  },
  121: { // New York Mets
    primary: '#002D72', secondary: '#FF5910', accent: '#FF5910',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-blue-950 to-orange-900', name: 'New York Mets',
  },
  143: { // Philadelphia Phillies
    primary: '#E81828', secondary: '#002D72', accent: '#FFFFFF',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-red-900 to-blue-950', name: 'Philadelphia Phillies',
  },
  120: { // Washington Nationals
    primary: '#AB0003', secondary: '#14225A', accent: '#FFFFFF',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-red-950 to-blue-950', name: 'Washington Nationals',
  },
  // NL Central
  112: { // Chicago Cubs
    primary: '#0E3386', secondary: '#CC3433', accent: '#FFFFFF',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-blue-900 to-red-900', name: 'Chicago Cubs',
  },
  113: { // Cincinnati Reds
    primary: '#C6011F', secondary: '#000000', accent: '#FFFFFF',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-red-950 to-black', name: 'Cincinnati Reds',
  },
  158: { // Milwaukee Brewers
    primary: '#12284B', secondary: '#B6922E', accent: '#B6922E',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-blue-950 to-yellow-900', name: 'Milwaukee Brewers',
  },
  134: { // Pittsburgh Pirates
    primary: '#27251F', secondary: '#FDB827', accent: '#FDB827',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-black to-yellow-950', name: 'Pittsburgh Pirates',
  },
  138: { // St. Louis Cardinals
    primary: '#C41E3A', secondary: '#0C2340', accent: '#FEDB00',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-red-900 to-blue-950', name: 'St. Louis Cardinals',
  },
  // NL West
  109: { // Arizona Diamondbacks
    primary: '#A71930', secondary: '#E3D4AD', accent: '#000000',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-red-950 to-yellow-950', name: 'Arizona Diamondbacks',
  },
  115: { // Colorado Rockies
    primary: '#333366', secondary: '#C4CED4', accent: '#231F20',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-purple-950 to-gray-900', name: 'Colorado Rockies',
  },
  119: { // Los Angeles Dodgers
    primary: '#005A9C', secondary: '#EF3E42', accent: '#FFFFFF',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-blue-900 to-red-900', name: 'Los Angeles Dodgers',
  },
  135: { // San Diego Padres
    primary: '#2F241D', secondary: '#FFC425', accent: '#FFFFFF',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-amber-950 to-yellow-900', name: 'San Diego Padres',
  },
  137: { // San Francisco Giants
    primary: '#FD5A1E', secondary: '#27251F', accent: '#EFD19F',
    text: '#FFFFFF', background: '#eef4fb', cardBackground: '#ffffff',
    gradient: 'from-orange-900 to-black', name: 'San Francisco Giants',
  },
};

export const DEFAULT_THEME: TeamTheme = {
  primary: '#1e40af',
  secondary: '#1e3a5f',
  accent: '#60a5fa',
  text: '#FFFFFF',
  background: '#eef4fb',
  cardBackground: '#ffffff',
  gradient: 'from-blue-950 to-gray-900',
  name: 'Default',
};

export function getTeamTheme(teamId: number | null): TeamTheme {
  if (!teamId) return DEFAULT_THEME;
  return TEAM_THEMES[teamId] ?? DEFAULT_THEME;
}

export const ALL_TEAMS = [
  { id: 110, name: 'Baltimore Orioles', abbreviation: 'BAL', division: 'AL East' },
  { id: 111, name: 'Boston Red Sox', abbreviation: 'BOS', division: 'AL East' },
  { id: 147, name: 'New York Yankees', abbreviation: 'NYY', division: 'AL East' },
  { id: 139, name: 'Tampa Bay Rays', abbreviation: 'TB', division: 'AL East' },
  { id: 141, name: 'Toronto Blue Jays', abbreviation: 'TOR', division: 'AL East' },
  { id: 145, name: 'Chicago White Sox', abbreviation: 'CWS', division: 'AL Central' },
  { id: 114, name: 'Cleveland Guardians', abbreviation: 'CLE', division: 'AL Central' },
  { id: 116, name: 'Detroit Tigers', abbreviation: 'DET', division: 'AL Central' },
  { id: 118, name: 'Kansas City Royals', abbreviation: 'KC', division: 'AL Central' },
  { id: 142, name: 'Minnesota Twins', abbreviation: 'MIN', division: 'AL Central' },
  { id: 117, name: 'Houston Astros', abbreviation: 'HOU', division: 'AL West' },
  { id: 108, name: 'Los Angeles Angels', abbreviation: 'LAA', division: 'AL West' },
  { id: 133, name: 'Oakland Athletics', abbreviation: 'OAK', division: 'AL West' },
  { id: 136, name: 'Seattle Mariners', abbreviation: 'SEA', division: 'AL West' },
  { id: 140, name: 'Texas Rangers', abbreviation: 'TEX', division: 'AL West' },
  { id: 144, name: 'Atlanta Braves', abbreviation: 'ATL', division: 'NL East' },
  { id: 146, name: 'Miami Marlins', abbreviation: 'MIA', division: 'NL East' },
  { id: 121, name: 'New York Mets', abbreviation: 'NYM', division: 'NL East' },
  { id: 143, name: 'Philadelphia Phillies', abbreviation: 'PHI', division: 'NL East' },
  { id: 120, name: 'Washington Nationals', abbreviation: 'WSH', division: 'NL East' },
  { id: 112, name: 'Chicago Cubs', abbreviation: 'CHC', division: 'NL Central' },
  { id: 113, name: 'Cincinnati Reds', abbreviation: 'CIN', division: 'NL Central' },
  { id: 158, name: 'Milwaukee Brewers', abbreviation: 'MIL', division: 'NL Central' },
  { id: 134, name: 'Pittsburgh Pirates', abbreviation: 'PIT', division: 'NL Central' },
  { id: 138, name: 'St. Louis Cardinals', abbreviation: 'STL', division: 'NL Central' },
  { id: 109, name: 'Arizona Diamondbacks', abbreviation: 'ARI', division: 'NL West' },
  { id: 115, name: 'Colorado Rockies', abbreviation: 'COL', division: 'NL West' },
  { id: 119, name: 'Los Angeles Dodgers', abbreviation: 'LAD', division: 'NL West' },
  { id: 135, name: 'San Diego Padres', abbreviation: 'SD', division: 'NL West' },
  { id: 137, name: 'San Francisco Giants', abbreviation: 'SF', division: 'NL West' },
];
