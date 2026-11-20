import type { HostResolution, TokenPair } from '@edura/contracts';
import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, PATH_HEADER, REFRESH_COOKIE, SITE_HEADER, sessionCookieOptions } from './lib/cookies';
import { refreshOnce } from './lib/refresh';
import { internalPath, isSharedPath, safeNext, tokenExpiresSoon } from './lib/routing';

const IDENTITY_URL = process.env.IDENTITY_URL ?? 'http://127.0.0.1:4002';
const TENANTS_URL = process.env.TENANTS_URL ?? 'http://127.0.0.1:4001';
const RENEW_PATH = '/auth/renew';

async function resolveSite(host: string): Promise<HostResolution | null> {
  const response = await fetch(`${TENANTS_URL}/resolve?host=${encodeURIComponent(host)}`, {
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Site lookup failed: ${response.status}`);
  return (await response.json()) as HostResolution;
}

async function exchange(refreshToken: string): Promise<TokenPair | null> {
  const response = await fetch(`${IDENTITY_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Refresh failed: ${response.status}`);
  return (await response.json()) as TokenPair;
}

/**
 * The address the visitor used. After a form redirect, Next fetches the next page itself from
 * localhost and carries the real address in x-forwarded-host. A browser can't set that header.
 */
const visitorHost = (request: NextRequest) =>
  request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';

/** Uses the visitor's address, which resolveSite has just confirmed is one of ours. */
const redirectTo = (request: NextRequest, path: string) =>
  NextResponse.redirect(new URL(path, `${request.nextUrl.protocol}//${visitorHost(request)}`), 307);

/**
 * nextUrl keeps the rewrite internal. Next normalises its host to localhost, so the server must
 * listen on `localhost`: bound to 127.0.0.1, every rewrite would look like an external one.
 */
function internalUrl(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return url;
}

const unavailable = () => new NextResponse('Edura is temporarily unavailable.', { status: 503 });

export async function proxy(request: NextRequest) {
  let site: HostResolution | null;
  try {
    site = await resolveSite(visitorHost(request));
  } catch {
    return unavailable();
  }
  if (!site) return NextResponse.rewrite(internalUrl(request, '/unknown-site'), { status: 404 });
  if (site.kind === 'tenant' && site.status === 'SUSPENDED') {
    return NextResponse.rewrite(internalUrl(request, '/suspended'), { status: 403 });
  }

  const { pathname, search } = request.nextUrl;
  const isRenew = pathname === RENEW_PATH;
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const accessIsStale = !access || tokenExpiresSoon(access, Date.now());

  // The only place tokens are refreshed, so one exchange can serve every parallel request.
  let renewed: TokenPair | null = null;
  let sessionEnded = false;
  if (refresh && (accessIsStale || isRenew)) {
    try {
      renewed = await refreshOnce(refresh, exchange);
    } catch {
      return unavailable();
    }
    sessionEnded = renewed === null;
  }
  const signedIn = renewed !== null || (!sessionEnded && !!access && !accessIsStale);

  const finish = (response: NextResponse) => {
    if (renewed) {
      const options = sessionCookieOptions(renewed);
      response.cookies.set(ACCESS_COOKIE, renewed.accessToken, options);
      response.cookies.set(REFRESH_COOKIE, renewed.refreshToken, options);
    } else if (sessionEnded || (isRenew && !signedIn)) {
      response.cookies.delete(ACCESS_COOKIE);
      response.cookies.delete(REFRESH_COOKIE);
    }
    return response;
  };

  if (isRenew) {
    const next = safeNext(request.nextUrl.searchParams.get('next'));
    return finish(redirectTo(request, renewed ? next : `/login?next=${encodeURIComponent(next)}`));
  }
  if (signedIn && pathname === '/login') return finish(redirectTo(request, '/'));
  // A signed-out visitor to the home address sees that site's public website.
  const showsPublicSite = !signedIn && pathname === '/';
  if (!signedIn && !isSharedPath(pathname) && !showsPublicSite) {
    return finish(redirectTo(request, `/login?next=${encodeURIComponent(pathname + search)}`));
  }

  // The current request must see the new token, not just the browser's next one.
  if (renewed) {
    request.cookies.set(ACCESS_COOKIE, renewed.accessToken);
    request.cookies.set(REFRESH_COOKIE, renewed.refreshToken);
  }
  // Always overwritten here, so a visitor can't supply their own values.
  const headers = new Headers(request.headers);
  headers.set(SITE_HEADER, encodeURIComponent(JSON.stringify(site)));
  headers.set(PATH_HEADER, pathname + search);

  const publicHome = site.kind === 'tenant' ? '/public-site' : '/main-site';
  const target = showsPublicSite ? publicHome : internalPath(site, pathname);
  if (target === pathname) return finish(NextResponse.next({ request: { headers } }));
  return finish(NextResponse.rewrite(internalUrl(request, target), { request: { headers } }));
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
