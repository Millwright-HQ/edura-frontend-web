import 'server-only';
import type { PublicSiteDto } from '@edura/contracts';
import { headers } from 'next/headers';
import { cache } from 'react';
import { callService } from './server';

/** The tenant's published settings, fetched once per page render. */
export const getPublicSite = cache(async (): Promise<PublicSiteDto | null> => {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? '';
  const result = await callService<PublicSiteDto>('comms', `/public/site?host=${encodeURIComponent(host)}`);
  return result.ok ? result.data : null;
});

/** A short-lived address for one of the academy's public images (logo, tutor photos). */
export async function publicImageUrl(imageId: string | undefined): Promise<string | undefined> {
  if (!imageId) return undefined;
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? '';
  const result = await callService<{ url: string }>('academic', `/public/media/${imageId}?host=${encodeURIComponent(host)}`);
  return result.ok ? result.data.url : undefined;
}

/** Fetched once per page render, however many places show the logo. */
export const getLogoUrl = cache(async () => publicImageUrl((await getPublicSite())?.logoImageId));

export async function getTimezone(): Promise<string> {
  return (await getPublicSite())?.timezone ?? 'UTC';
}
