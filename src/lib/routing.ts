import type { HostResolution } from '@edura/contracts';

/** Pages that look the same on every site and need no session. */
const SHARED_PATHS = ['/login', '/login/verify', '/login/setup', '/forgot-password', '/set-password', '/join', '/start', '/zoom-callback'];

export const isSharedPath = (pathname: string) => SHARED_PATHS.includes(pathname);

/**
 * Maps a public URL to the page tree for its site. Everything else is always prefixed, so
 * `/platform/...` typed on a tenant's address becomes `/tenant/platform/...` and finds nothing.
 */
export function internalPath(site: HostResolution, pathname: string): string {
  if (isSharedPath(pathname)) return pathname;
  const root = site.kind === 'platform' ? '/platform' : '/tenant';
  return pathname === '/' ? root : `${root}${pathname}`;
}

/** Only same-site paths, so a crafted login link cannot send people elsewhere. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}

/**
 * Reads the token's expiry to decide when to refresh. It does not verify the signature, and
 * does not need to: the services do that on every call.
 */
export function tokenExpiresSoon(token: string, nowMs: number, marginSeconds = 30): boolean {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as { exp?: unknown };
    return typeof payload.exp !== 'number' || payload.exp - marginSeconds <= nowMs / 1000;
  } catch {
    return true;
  }
}
