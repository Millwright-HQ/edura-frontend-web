import type { HostResolution, TokenPair } from '@edura/contracts';
import { describe, expect, it, vi } from 'vitest';
import { refreshOnce } from './refresh';
import { internalPath, safeNext, tokenExpiresSoon } from './routing';

const platform: HostResolution = { kind: 'platform' };
const tenant: HostResolution = {
  kind: 'tenant',
  tenantId: 'x',
  slug: 'acme',
  name: 'Acme',
  status: 'ACTIVE',
};

describe('internalPath', () => {
  it('sends each site to its own page tree', () => {
    expect(internalPath(platform, '/')).toBe('/platform');
    expect(internalPath(platform, '/tenants')).toBe('/platform/tenants');
    expect(internalPath(tenant, '/')).toBe('/tenant');
  });

  it('keeps shared pages unprefixed', () => {
    expect(internalPath(tenant, '/login')).toBe('/login');
    expect(internalPath(platform, '/set-password')).toBe('/set-password');
    expect(internalPath(tenant, '/join')).toBe('/join');
  });

  it('never lets a tenant address reach the platform pages', () => {
    expect(internalPath(tenant, '/platform/tenants')).toBe('/tenant/platform/tenants');
  });
});

describe('safeNext', () => {
  it.each(['/', '/tenants?page=2'])('keeps %s', (path) => expect(safeNext(path)).toBe(path));

  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '', null, undefined])(
    'replaces %s',
    (path) => expect(safeNext(path)).toBe('/'),
  );
});

describe('tokenExpiresSoon', () => {
  const token = (exp: unknown) =>
    `h.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.s`;

  it('is false well before expiry and true inside the margin', () => {
    expect(tokenExpiresSoon(token(1000), 900_000)).toBe(false);
    expect(tokenExpiresSoon(token(1000), 980_000)).toBe(true);
  });

  it('treats anything unreadable as expired', () => {
    expect(tokenExpiresSoon('junk', 0)).toBe(true);
    expect(tokenExpiresSoon(token('soon'), 0)).toBe(true);
  });
});

describe('refreshOnce', () => {
  const pair = { accessToken: 'a' } as TokenPair;

  it('exchanges a token once for simultaneous and shortly later callers', async () => {
    const exchange = vi.fn(async () => pair);
    const results = await Promise.all([
      refreshOnce('rt-1', exchange, 1000),
      refreshOnce('rt-1', exchange, 1000),
    ]);
    await refreshOnce('rt-1', exchange, 5000);
    expect(exchange).toHaveBeenCalledOnce();
    expect(results).toEqual([pair, pair]);
  });

  it('allows a retry after a network failure', async () => {
    const exchange = vi
      .fn<() => Promise<TokenPair | null>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(pair);
    await expect(refreshOnce('rt-2', exchange, 1000)).rejects.toThrow('down');
    await expect(refreshOnce('rt-2', exchange, 1000)).resolves.toBe(pair);
  });
});
