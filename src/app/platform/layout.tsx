import type { ReactNode } from 'react';
import { getMe } from '@/lib/server';
import { ConsoleShell } from '@/lib/ui';

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  const can = (permission: string) => me.permissions.includes(permission);
  const items = (rows: [boolean, string, string][]) =>
    rows.filter(([show]) => show).map(([, href, label]) => ({ href, label }));
  const groups = [
    {
      name: 'Academies',
      items: items([
        [can('platform.tenants.read'), '/tenants', 'Tenants'],
        [can('platform.usage.read'), '/usage', 'Usage'],
        [can('platform.audit.read'), '/audit', 'Audit log'],
      ]),
    },
    { name: 'Billing', items: items([[can('platform.invoices.read'), '/ledger', 'Tenant invoices']]) },
    {
      name: 'Team',
      items: items([
        [can('platform.staff.read'), '/staff', 'Staff'],
        [can('platform.roles.read'), '/roles', 'Roles'],
      ]),
    },
    { name: 'You', items: items([[true, '/account', 'My account']]) },
  ];
  const search = can('platform.tenants.read')
    ? { action: '/tenants', name: 'search', placeholder: 'Search academies' }
    : undefined;
  return (
    <ConsoleShell site="Edura" caption="Platform" me={me} groups={groups} search={search} platform>
      {children}
    </ConsoleShell>
  );
}
