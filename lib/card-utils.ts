import { EbayListing } from '@/types';

export interface FeaturedCard {
  listing: EbayListing;
  cardType: string;
  badge: string;
}

const CARD_TYPE_RULES: Array<{ pattern: RegExp; type: string; badge: string }> = [
  { pattern: /auto(graph)?/i,                      type: 'Autograph',          badge: '✍️ Auto'       },
  { pattern: /\b(rc|rookie card|rookie)\b/i,       type: 'Rookie Card',        badge: '🌟 Rookie Card' },
  { pattern: /1\/1|one.of.one/i,                   type: '1/1 One-of-One',     badge: '💎 1/1'         },
  { pattern: /refractor/i,                         type: 'Chrome Refractor',   badge: '✨ Refractor'   },
  { pattern: /chrome/i,                            type: 'Bowman Chrome',      badge: '🔵 Chrome'      },
  { pattern: /bowman/i,                            type: 'Bowman Prospect',    badge: '🟢 Bowman'      },
  { pattern: /gold\s*(parallel|foil)?/i,           type: 'Gold Parallel',      badge: '🥇 Gold'        },
  { pattern: /prizm/i,                             type: 'Prizm',              badge: '🌈 Prizm'       },
  { pattern: /superfractor/i,                      type: 'Superfractor',       badge: '🔥 Superfractor'},
  { pattern: /topps\s*series\s*1/i,               type: 'Topps Series 1',     badge: '📦 Topps S1'   },
  { pattern: /topps/i,                             type: 'Topps Base',         badge: '📋 Topps'       },
  { pattern: /optic/i,                             type: 'Donruss Optic',      badge: '💠 Optic'       },
];

export function identifyCardType(title: string): { type: string; badge: string } {
  for (const rule of CARD_TYPE_RULES) {
    if (rule.pattern.test(title)) {
      return { type: rule.type, badge: rule.badge };
    }
  }
  return { type: 'Base Card', badge: '📄 Base' };
}

export function getFeaturedCard(listings: EbayListing[]): FeaturedCard | null {
  if (!listings.length) return null;

  // Score each listing: higher price + better card type = higher score
  const CARD_TYPE_PRIORITY: Record<string, number> = {
    'Autograph': 100, '1/1 One-of-One': 95, 'Superfractor': 90,
    'Chrome Refractor': 80, 'Bowman Chrome': 75, 'Prizm': 70,
    'Gold Parallel': 65, 'Rookie Card': 85, 'Bowman Prospect': 55,
    'Donruss Optic': 50, 'Topps Series 1': 40, 'Topps Base': 30, 'Base Card': 20,
  };

  const scored = listings.map(listing => {
    const { type, badge } = identifyCardType(listing.title);
    const typePriority = CARD_TYPE_PRIORITY[type] ?? 20;
    const priceScore = Math.min(listing.price / 5, 50); // cap price contribution
    return { listing, cardType: type, badge, score: typePriority + priceScore };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return { listing: best.listing, cardType: best.cardType, badge: best.badge };
}
