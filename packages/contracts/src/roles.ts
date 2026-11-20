import {
  ALL_PLATFORM_PERMISSIONS,
  ALL_TENANT_PERMISSIONS,
  type Permission,
  type PlatformPermission,
} from './permissions';

export type RoleScope = 'platform' | 'tenant';

export interface SystemRole {
  readonly id: string;
  readonly scope: RoleScope;
  readonly name: string;
  readonly description: string;
  /** System roles cannot be edited or deleted. */
  readonly system: true;
  readonly permissions: readonly Permission[];
}

export interface CustomRole {
  readonly id: string;
  readonly scope: RoleScope;
  readonly name: string;
  readonly description?: string;
  readonly system: false;
  readonly permissions: readonly Permission[];
}

const readOnlyPlatform = ALL_PLATFORM_PERMISSIONS.filter((p) => p.endsWith('.read'));

const financePlatform: PlatformPermission[] = [
  'platform.invoices.read',
  'platform.invoices.create',
  'platform.invoices.update',
  'platform.invoices.void',
  'platform.tenants.read',
  'platform.usage.read',
];

const supportPlatform: PlatformPermission[] = [
  'platform.tenants.read',
  'platform.tenants.update',
  'platform.usage.read',
  'platform.audit.read',
  'platform.support.impersonate',
];

/** Fixed roles accepted by the user on 2026-10-21: Owner, Support, Finance, Read-only. */
export const PLATFORM_SYSTEM_ROLES: readonly SystemRole[] = [
  {
    id: 'platform_owner',
    scope: 'platform',
    name: 'Owner',
    description: 'Full access to the platform console.',
    system: true,
    permissions: ALL_PLATFORM_PERMISSIONS,
  },
  {
    id: 'platform_support',
    scope: 'platform',
    name: 'Support',
    description: 'Look up tenants, adjust tenant settings and assist users.',
    system: true,
    permissions: supportPlatform,
  },
  {
    id: 'platform_finance',
    scope: 'platform',
    name: 'Finance',
    description: 'Manage the tenant invoice ledger and view usage.',
    system: true,
    permissions: financePlatform,
  },
  {
    id: 'platform_readonly',
    scope: 'platform',
    name: 'Read-only',
    description: 'View everything, change nothing.',
    system: true,
    permissions: readOnlyPlatform,
  },
];

/**
 * Tenant fixed roles. Parent and Student carry NO permission list: their access is decided by
 * relationship (own children / own records) in the services, not by editable permissions.
 */
export const TENANT_SYSTEM_ROLES: readonly SystemRole[] = [
  {
    id: 'tenant_admin',
    scope: 'tenant',
    name: 'Admin',
    description: 'Full access inside the tenant.',
    system: true,
    permissions: ALL_TENANT_PERMISSIONS,
  },
  {
    id: 'tenant_teacher',
    scope: 'tenant',
    name: 'Teacher',
    description:
      'Sees and does only what the admin allows in each student group they are added to (materials, classes, recordings, students).',
    system: true,
    permissions: ['tenant.teaching.access'],
  },
  {
    id: 'tenant_parent',
    scope: 'tenant',
    name: 'Parent',
    description: 'Access to own children, their classes and invoices (relationship based).',
    system: true,
    permissions: [],
  },
  {
    id: 'tenant_student',
    scope: 'tenant',
    name: 'Student',
    description: 'Access to own courses, classes and announcements (relationship based).',
    system: true,
    permissions: [],
  },
];

/** A grantor may only give permissions they hold themselves. Returns the offending keys. */
export function findUngrantable(
  grantorPermissions: ReadonlySet<string>,
  requested: readonly string[],
): string[] {
  return requested.filter((p) => !grantorPermissions.has(p));
}
