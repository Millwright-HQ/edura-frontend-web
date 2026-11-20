import { NextResponse, type NextRequest } from 'next/server';
import { callAsUser } from '@/lib/server';

export async function GET(request: NextRequest) {
  const result = await callAsUser('zoom', '/zoom/callback', {
    method: 'POST',
    body: {
      code: request.nextUrl.searchParams.get('code') ?? '',
      state: request.nextUrl.searchParams.get('state') ?? '',
    },
  });
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const outcome = result.ok ? 'connected' : 'failed';
  return NextResponse.redirect(new URL(`${request.nextUrl.protocol}//${host}/settings?zoom=${outcome}`), 302);
}
