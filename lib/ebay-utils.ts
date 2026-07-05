export function getEbaySearchUrl(playerName: string): string {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(playerName + ' baseball card')}&_sacat=212`;
}
