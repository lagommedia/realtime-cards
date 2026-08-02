import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export interface CardAnalysis {
  playerName: string | null;
  year: string | null;
  set: string | null;
  grade: string | null;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `You are analyzing a baseball card photo. The card may be raw (ungraded) or sealed inside a graded slab (PSA, BGS, SGC, CSG, etc.).

IF THE CARD IS IN A GRADED SLAB:
- Read the certification label printed on the slab — it is the most reliable source of truth.
- The label shows the grade prominently (e.g. "GEM-MT 10", "NM-MT+ 8.5", "PRISTINE 10").
- The label also shows the player name, year, card number, and set name.
- Prefix the grade with the grader: "PSA 10", "BGS 9.5", "SGC 10", "CSG 9", etc.

IF THE CARD IS RAW (no slab):
- Read the card face directly for all fields.
- grade should be "Raw".

Extract exactly these four fields:
1. playerName — full player name (e.g. "Juan Soto", "Ronald Acuña Jr.")
2. year — 4-digit year the card was issued (e.g. "2021")
3. set — card set/product name WITHOUT the year (e.g. "Topps Chrome", "Bowman Platinum", "Topps Series 1")
4. grade — graded grade with grader prefix (e.g. "PSA 10", "BGS 9.5") OR "Raw" if ungraded

Respond with ONLY valid JSON, no markdown, no explanation:
{"playerName":"...","year":"...","set":"...","grade":"..."}

Use null for any field you cannot determine with confidence.`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  let imageDataUrl: string;
  try {
    ({ imageDataUrl } = await req.json() as { imageDataUrl: string });
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Strip the data URL prefix to get raw base64 + media type
  const sepIdx = imageDataUrl.indexOf(',');
  const headerPart = sepIdx >= 0 ? imageDataUrl.slice(0, sepIdx) : '';
  const base64Part = sepIdx >= 0 ? imageDataUrl.slice(sepIdx + 1) : '';
  const mtMatch = headerPart.match(/^data:(image\/[a-z+]+);base64$/);
  const match: [string, string, string] | null = mtMatch ? [imageDataUrl, mtMatch[1], base64Part] : null;
  if (!match) {
    return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
  }
  const [, mediaType, base64Data] = match;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64Data,
              },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}';
    // Strip markdown code fences Claude sometimes adds despite "no markdown" instruction
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const result = JSON.parse(text) as CardAnalysis;
    return NextResponse.json(result);
  } catch (err) {
    console.error('Card analyze error:', err);
    return NextResponse.json({ playerName: null, year: null, set: null, grade: null });
  }
}
