import { NextRequest, NextResponse } from 'next/server';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) return new NextResponse(null, { status: 400 });

  try { new URL(url); } catch { return new NextResponse(null, { status: 400 }); }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'image/*,*/*' },
      redirect: 'follow',
    });
    if (!res.ok) return new NextResponse(null, { status: 502 });
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.startsWith('image/')) return new NextResponse(null, { status: 422 });
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=604800',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
