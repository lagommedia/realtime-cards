import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export interface CardAnalysis {
  playerName: string | null;
  year: string | null;
  set: string | null;
  grade: string | null;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `You are analyzing a baseball card image. Extract exactly these four fields:
1. playerName — full player name as printed on the card (e.g. "Juan Soto")
2. year — 4-digit year printed on the card (e.g. "2021"). Look for it in the card design, corner, or back.
3. set — the card set/product name (e.g. "Topps Chrome", "Bowman Platinum", "Panini Prizm"). Do NOT include the year in the set name.
4. grade — if the card is in a graded slab (PSA, BGS, SGC, CSG), return the grade like "PSA 10", "BGS 9.5", "SGC 9". If raw/ungraded, return "Raw".

Respond with ONLY valid JSON, no markdown, no explanation:
{"playerName":"...","year":"...","set":"...","grade":"..."}

If you cannot determine a field with confidence, use null for that field.`;

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

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}';
    const result = JSON.parse(text) as CardAnalysis;
    return NextResponse.json(result);
  } catch (err) {
    console.error('Card analyze error:', err);
    return NextResponse.json({ playerName: null, year: null, set: null, grade: null });
  }
}
