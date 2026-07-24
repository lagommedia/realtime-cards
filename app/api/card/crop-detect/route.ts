import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export interface CropDetection {
  x: number; // fraction of image width, 0–1
  y: number; // fraction of image height, 0–1
  w: number; // fraction of image width, 0–1
  h: number; // fraction of image height, 0–1
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `Locate the baseball card in this photo. Return the bounding box of the card only — exclude background, hands, table, or any slab holder border outside the card artwork.

Respond with ONLY valid JSON (values are fractions of the full image dimensions, 0.0–1.0):
{"x":0.05,"y":0.08,"w":0.90,"h":0.84}

x,y = top-left corner of the card. w,h = card width and height.
If you cannot identify a card with confidence, respond: {"x":0.0,"y":0.0,"w":1.0,"h":1.0}`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(null, { status: 503 });
  }

  let imageDataUrl: string;
  try {
    ({ imageDataUrl } = await req.json() as { imageDataUrl: string });
  } catch {
    return NextResponse.json(null, { status: 400 });
  }

  const sepIdx = imageDataUrl.indexOf(',');
  const header = sepIdx >= 0 ? imageDataUrl.slice(0, sepIdx) : '';
  const b64    = sepIdx >= 0 ? imageDataUrl.slice(sepIdx + 1) : '';
  const mtMatch = header.match(/^data:(image\/[a-z+]+);base64$/);
  if (!mtMatch) return NextResponse.json(null, { status: 400 });

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mtMatch[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: b64,
            },
          },
          { type: 'text', text: PROMPT },
        ],
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}';
    const result = JSON.parse(text) as CropDetection;
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(null);
  }
}
