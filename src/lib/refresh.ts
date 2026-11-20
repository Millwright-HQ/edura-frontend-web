import type { TokenPair } from '@edura/contracts';

interface Entry {
  promise: Promise<TokenPair | null>;
  expires: number;
}

/** How long the answer stays reusable for requests still carrying the old cookie. */
const REUSE_MS = 30_000;

const globalStore = globalThis as unknown as { __eduraRefreshes?: Map<string, Entry> };
const refreshes = (globalStore.__eduraRefreshes ??= new Map<string, Entry>());

/**
 * A page load fires several requests at once, all carrying the same refresh token, and replaying
 * a used token ends the session. So each token is exchanged once and everyone shares the result.
 * This holds within one server process; running several needs a shared store (docs/06).
 */
export function refreshOnce(
  refreshToken: string,
  exchange: (token: string) => Promise<TokenPair | null>,
  now = Date.now(),
): Promise<TokenPair | null> {
  for (const [key, entry] of refreshes) {
    if (entry.expires <= now) refreshes.delete(key);
  }
  const existing = refreshes.get(refreshToken);
  if (existing) return existing.promise;

  const promise = exchange(refreshToken);
  refreshes.set(refreshToken, { promise, expires: now + REUSE_MS });
  // A network failure says nothing about the token, so allow a retry.
  promise.catch(() => refreshes.delete(refreshToken));
  return promise;
}
