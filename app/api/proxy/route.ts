import { Buffer } from 'buffer';
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = new Set(['i.pinimg.com']);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const encodedUrl = searchParams.get('url');
    if (!encodedUrl) {
      return NextResponse.json({ error: 'Missing url parameter.' }, { status: 400 });
    }

    const target = new URL(encodedUrl);
    if (!ALLOWED_HOSTS.has(target.hostname)) {
      return NextResponse.json({ error: 'Only Pinterest image hosts are supported.' }, { status: 400 });
    }

    const upstream = await fetch(target.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36'
      }
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: 'Failed to retrieve image from Pinterest.' }, { status: 502 });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const contentType = upstream.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(Buffer.from(arrayBuffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
