import { NextResponse, type NextRequest } from 'next/server';

/**
 * Zoom only allows fixed return addresses, so every tenant returns here, on the platform's
 * address, and is sent on to its own site. The slug comes from the state, and only ever chooses
 * a subdomain of this site; the signature in the state is checked by the classes service.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code') ?? '';
  const state = request.nextUrl.searchParams.get('state') ?? '';
  const slug = state.split('.')[0] ?? '';
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  if (!/^[a-z0-9-]{3,63}$/.test(slug)) {
    return new NextResponse('This Zoom return link is missing its academy details. Start again from your academy: Settings, then Connect Zoom.', { status: 400 });
  }
  const target = new URL(`${request.nextUrl.protocol}//${slug}.${host}/settings/zoom-complete`);
  target.searchParams.set('code', code);
  target.searchParams.set('state', state);
  return NextResponse.redirect(target, 302);
}
