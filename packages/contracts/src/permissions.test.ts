import { describe, expect, it } from 'vitest';
import {
  ALL_PLATFORM_PERMISSIONS,
  ALL_TENANT_PERMISSIONS,
  isPlatformPermission,
  isTenantPermission,
} from './permissions';
import { PLATFORM_SYSTEM_ROLES, TENANT_SYSTEM_ROLES, findUngrantable } from './roles';

describe('permissions', () => {
  it('has unique keys with the right scope prefix', () => {
    expect(new Set(ALL_PLATFORM_PERMISSIONS).size).toBe(ALL_PLATFORM_PERMISSIONS.length);
    expect(new Set(ALL_TENANT_PERMISSIONS).size).toBe(ALL_TENANT_PERMISSIONS.length);
    expect(ALL_PLATFORM_PERMISSIONS.every((k) => k.startsWith('platform.'))).toBe(true);
    expect(ALL_TENANT_PERMISSIONS.every((k) => k.startsWith('tenant.'))).toBe(true);
  });

  it('has no quiz permissions in v1', () => {
    const all: string[] = [...ALL_PLATFORM_PERMISSIONS, ...ALL_TENANT_PERMISSIONS];
    expect(all.some((k) => k.includes('quiz'))).toBe(false);
  });

  it('narrows keys by scope', () => {
    expect(isTenantPermission('tenant.users.read')).toBe(true);
    expect(isTenantPermission('platform.tenants.read')).toBe(false);
    expect(isPlatformPermission('platform.tenants.read')).toBe(true);
  });
});

describe('system roles', () => {
  const all = new Set<string>([...ALL_PLATFORM_PERMISSIONS, ...ALL_TENANT_PERMISSIONS]);

  it('only reference known permission keys', () => {
    for (const role of [...PLATFORM_SYSTEM_ROLES, ...TENANT_SYSTEM_ROLES]) {
      for (const p of role.permissions) expect(all.has(p)).toBe(true);
    }
  });

  it('keeps each role inside its scope', () => {
    for (const role of PLATFORM_SYSTEM_ROLES) {
      expect(role.permissions.every((p) => p.startsWith('platform.'))).toBe(true);
    }
    for (const role of TENANT_SYSTEM_ROLES) {
      expect(role.permissions.every((p) => p.startsWith('tenant.'))).toBe(true);
    }
  });

  it('read-only role has no write permission', () => {
    const ro = PLATFORM_SYSTEM_ROLES.find((r) => r.id === 'platform_readonly')!;
    expect(ro.permissions.every((p) => p.endsWith('.read'))).toBe(true);
  });

  it('owner and admin hold every permission of their scope', () => {
    const owner = PLATFORM_SYSTEM_ROLES.find((r) => r.id === 'platform_owner')!;
    const admin = TENANT_SYSTEM_ROLES.find((r) => r.id === 'tenant_admin')!;
    expect(owner.permissions).toHaveLength(ALL_PLATFORM_PERMISSIONS.length);
    expect(admin.permissions).toHaveLength(ALL_TENANT_PERMISSIONS.length);
  });

  it('prevents granting permissions the grantor lacks', () => {
    const grantor = new Set(['tenant.users.read']);
    expect(findUngrantable(grantor, ['tenant.users.read', 'tenant.users.create'])).toEqual([
      'tenant.users.create',
    ]);
  });
});
