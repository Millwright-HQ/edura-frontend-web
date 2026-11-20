/**
 * Permission keys are `<scope>.<module>.<action>`. Scope `platform` applies to the Edura console,
 * scope `tenant` to a single tenant. Quizzes are intentionally absent (release phase 2).
 */
export const PLATFORM_MODULES = {
  tenants: ['read', 'create', 'update', 'suspend', 'delete'],
  staff: ['read', 'create', 'update', 'deactivate'],
  roles: ['read', 'create', 'update', 'delete'],
  invoices: ['read', 'create', 'update', 'void'],
  usage: ['read'],
  audit: ['read'],
  settings: ['read', 'update'],
  support: ['impersonate'],
} as const;

export const TENANT_MODULES = {
  users: ['read', 'create', 'update', 'deactivate', 'erase'],
  requests: ['read', 'approve', 'reject'],
  inquiries: ['read', 'update'],
  courses: ['read', 'create', 'update', 'deactivate', 'reorder'],
  content: ['read', 'upload', 'update', 'delete'],
  groups: ['read', 'create', 'update', 'manage_students', 'deactivate'],
  classes: ['read', 'create', 'update', 'delete'],
  attendance: ['read', 'mark'],
  zoom: ['connect', 'disconnect'],
  invoices: ['read', 'create', 'update', 'mark_paid', 'cancel'],
  feedback: ['read', 'create', 'update', 'delete'],
  roles: ['read', 'create', 'update', 'delete'],
  staff: ['read', 'create', 'update', 'deactivate'],
  announcements: ['read', 'create', 'update', 'delete'],
  settings: ['read', 'update'],
  audit: ['read'],
  payment_details: ['read', 'update'],
  dashboard: ['view'],
  // Works only inside the groups a person is assigned to; what they may do there is set per group.
  teaching: ['access'],
} as const;

type Keys<S extends string, M extends Record<string, readonly string[]>> = {
  [K in keyof M & string]: `${S}.${K}.${M[K][number]}`;
}[keyof M & string];

export type PlatformPermission = Keys<'platform', typeof PLATFORM_MODULES>;
export type TenantPermission = Keys<'tenant', typeof TENANT_MODULES>;
export type Permission = PlatformPermission | TenantPermission;

function expand<S extends string, M extends Record<string, readonly string[]>>(
  scope: S,
  modules: M,
): Keys<S, M>[] {
  return Object.entries(modules).flatMap(([mod, actions]) =>
    actions.map((a) => `${scope}.${mod}.${a}`),
  ) as Keys<S, M>[];
}

export const ALL_PLATFORM_PERMISSIONS: readonly PlatformPermission[] = expand(
  'platform',
  PLATFORM_MODULES,
);
export const ALL_TENANT_PERMISSIONS: readonly TenantPermission[] = expand('tenant', TENANT_MODULES);

export function isPlatformPermission(key: string): key is PlatformPermission {
  return (ALL_PLATFORM_PERMISSIONS as readonly string[]).includes(key);
}

export function isTenantPermission(key: string): key is TenantPermission {
  return (ALL_TENANT_PERMISSIONS as readonly string[]).includes(key);
}
