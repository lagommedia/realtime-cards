const EBAY_ROVER_BASE = 'https://rover.ebay.com/rover/1/711-53200-19255-0/1';
const EPN_CAMPAIGN_ID = '5339164547';

function toAffiliateUrl(ebayUrl: string): string {
  return `${EBAY_ROVER_BASE}?mpre=${encodeURIComponent(ebayUrl)}&campid=${EPN_CAMPAIGN_ID}`;
}

export function getEbaySearchUrl(playerName: string): string {
  const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(playerName + ' baseball card')}&_sacat=212`;
  return toAffiliateUrl(searchUrl);
}
