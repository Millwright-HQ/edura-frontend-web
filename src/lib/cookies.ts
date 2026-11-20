import type { TokenPair } from '@edura/contracts';

export const ACCESS_COOKIE = 'edura_at';
export const REFRESH_COOKIE = 'edura_rt';
/** Holds the five-minute pass between the password step and the code step of sign-in. */
export const MFA_COOKIE = 'edura_mfa';
/** Whether classes open inside Edura ('web') or in the Zoom app ('app', the default). Kept per browser, so a laptop and a phone can differ. */
export const CLASS_MODE_COOKIE = 'edura_class_mode';
export type ClassMode = 'web' | 'app';
export const SITE_HEADER = 'x-edura-site';
export const PATH_HEADER = 'x-edura-path';

/**
 * httpOnly keeps tokens away from page scripts. No `domain` is set, so a cookie stays on its
 * exact subdomain and one tenant's site never receives another's.
 */
export function sessionCookieOptions(pair: Pick<TokenPair, 'persistent' | 'sessionExpiresAt'>) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    ...(pair.persistent ? { expires: new Date(pair.sessionExpiresAt) } : {}),
  };
}
