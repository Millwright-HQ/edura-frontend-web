import type { GroupPermission, TeachingGroupDto } from '@edura/contracts';
import 'server-only';
import type { HostResolution, TokenPair } from '@edura/contracts';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ACCESS_COOKIE,
  CLASS_MODE_COOKIE,
  type ClassMode,
  PATH_HEADER,
  REFRESH_COOKIE,
  SITE_HEADER,
  sessionCookieOptions,
} from './cookies';

const SERVICES = {
  identity: process.env.IDENTITY_URL ?? 'http://127.0.0.1:4002',
  tenants: process.env.TENANTS_URL ?? 'http://127.0.0.1:4001',
  academic: process.env.ACADEMIC_URL ?? 'http://127.0.0.1:4003',
  classes: process.env.CLASSES_URL ?? 'http://127.0.0.1:4004',
  zoom: process.env.ZOOM_URL ?? 'http://127.0.0.1:4007',
  billing: process.env.BILLING_URL ?? 'http://127.0.0.1:4005',
  comms: process.env.COMMS_URL ?? 'http://127.0.0.1:4006',
};
type Service = keyof typeof SERVICES;

export interface ApiResult<T = unknown> {
  status: number;
  ok: boolean;
  data: T;
}

/** The browser's address as the edge reported it; the edge must overwrite this header, never relay it. */
async function visitorAddress(): Promise<string | undefined> {
  try {
    const list = await headers();
    return list.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function callService<T = unknown>(
  service: Service,
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<ApiResult<T>> {
  const visitor = await visitorAddress();
  const response = await fetch(`${SERVICES[service]}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(visitor ? { 'x-forwarded-for': visitor } : {}),
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    cache: 'no-store',
  });
  const text = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    data: (text ? JSON.parse(text) : undefined) as T,
  };
}

/** Calls as the signed-in user. A rejected token means roles changed, so get a fresh one. */
export async function callAsUser<T = unknown>(
  service: Service,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const result = await callService<T>(service, path, { ...init, ...(token ? { token } : {}) });
  if (result.status === 401) {
    const current = (await headers()).get(PATH_HEADER) ?? '/';
    redirect(`/auth/renew?next=${encodeURIComponent(current)}`);
  }
  return result;
}

export function errorMessage(result: ApiResult, fallback: string): string {
  const data = result.data as
    | { message?: unknown; issues?: { message?: string }[] }
    | undefined;
  const issue = data?.issues?.[0]?.message;
  if (issue) return issue;
  return typeof data?.message === 'string' ? data.message : fallback;
}

export async function getSite(): Promise<HostResolution> {
  const raw = (await headers()).get(SITE_HEADER);
  if (!raw) throw new Error('Site header missing; the proxy did not run');
  return JSON.parse(decodeURIComponent(raw)) as HostResolution;
}

export async function getClassMode(): Promise<ClassMode> {
  return (await cookies()).get(CLASS_MODE_COOKIE)?.value === 'web' ? 'web' : 'app';
}

export const siteName = (site: HostResolution) => (site.kind === 'tenant' ? site.name : 'Edura');

export async function storeSession(pair: TokenPair): Promise<void> {
  const store = await cookies();
  const options = sessionCookieOptions(pair);
  store.set(ACCESS_COOKIE, pair.accessToken, options);
  store.set(REFRESH_COOKIE, pair.refreshToken, options);
}

export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  kind: string;
  permissions: string[];
}

export async function getMe(): Promise<Me> {
  return (await callAsUser<Me>('identity', '/auth/me')).data;
}

/** The groups a teacher works in, with their rights in each. Empty for everyone else. */
export async function getTeaching(): Promise<TeachingGroupDto[]> {
  const result = await callAsUser<TeachingGroupDto[]>('academic', '/me/teaching');
  return result.ok ? result.data : [];
}

/** True for a teacher holding `permission` in at least one group that teaches the course. */
export const teacherCan = (groups: TeachingGroupDto[], courseId: string, permission: GroupPermission) =>
  groups.some((g) => g.permissions.includes(permission) && g.courses.some((c) => c.id === courseId));

export { REFRESH_COOKIE };
