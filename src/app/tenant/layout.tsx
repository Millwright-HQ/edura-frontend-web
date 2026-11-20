import type { NotificationsDto, PersonDto } from '@edura/contracts';
import type { ReactNode } from 'react';
import { callAsUser, getMe, getSite, siteName } from '@/lib/server';
import { getPublicSite } from '@/lib/site';
import { BrandStyle, ConsoleShell, TopShell } from '@/lib/ui';
import { LiveBanner } from './live-banner';

export default async function TenantLayout({ children }: { children: ReactNode }) {
  const [me, site, publicSite, bell] = await Promise.all([
    getMe(),
    getSite(),
    getPublicSite(),
    callAsUser<NotificationsDto>('comms', '/me/notifications'),
  ]);
  const academy = publicSite?.displayName || siteName(site);
  const unread = bell.ok ? bell.data.unread : 0;

  if (me.kind === 'student' || me.kind === 'parent') {
    // A student with no parent receives their own invoices.
    let billed = me.kind === 'parent';
    if (me.kind === 'student') {
      const family = await callAsUser<{ parents: PersonDto[] }>('identity', '/me/family');
      billed = family.ok && family.data.parents.length === 0;
    }
    const nav = [
      { href: '/', label: 'Home' },
      ...(me.kind === 'student' ? [{ href: '/my-courses', label: 'My courses' }] : []),
      { href: '/schedule', label: 'Schedule' },
      ...(billed ? [{ href: '/invoices', label: 'Invoices' }] : []),
      { href: '/announcements', label: 'Announcements' },
      { href: '/account', label: 'Account' },
    ];
    return (
      <>
        <BrandStyle color={publicSite?.primaryColor} />
        <TopShell site={academy} me={me} nav={nav} unread={unread}>
          <LiveBanner me={me} />
          {children}
        </TopShell>
      </>
    );
  }

  const can = (permission: string) => me.permissions.includes(permission);
  // A teacher has no admin screens: they see the groups they were added to.
  const teacherOnly = can('tenant.teaching.access') && !can('tenant.courses.read');
  const items = (rows: [boolean, string, string][]) =>
    rows.filter(([show]) => show).map(([, href, label]) => ({ href, label }));
  const groups = [
    { name: 'Overview', items: items([[true, '/', 'Dashboard']]) },
    {
      name: 'People',
      items: items([
        [can('tenant.users.read'), '/students', 'Students'],
        [can('tenant.users.read'), '/parents', 'Parents'],
        [can('tenant.requests.read'), '/requests', 'Enrolment requests'],
        [can('tenant.staff.read'), '/staff', 'Staff'],
        [can('tenant.roles.read'), '/roles', 'Roles'],
      ]),
    },
    {
      name: 'Teaching',
      items: items([
        [teacherOnly, '/teaching', 'My groups'],
        [can('tenant.courses.read'), '/courses', 'Courses'],
        [can('tenant.groups.read'), '/groups', 'Student groups'],
        [can('tenant.classes.read') || teacherOnly, '/schedule', 'Class schedule'],
        [can('tenant.classes.read') || can('tenant.teaching.access'), '/live-classes', 'Live classes'],
      ]),
    },
    { name: 'Money', items: items([[can('tenant.invoices.read'), '/invoices', 'Invoices']]) },
    {
      name: 'Messages',
      items: items([
        [can('tenant.announcements.read'), '/announcements', 'Announcements'],
        [can('tenant.inquiries.read'), '/enquiries', 'Enquiries'],
        [can('tenant.feedback.read'), '/feedback', 'Feedback'],
      ]),
    },
    {
      name: 'Academy',
      items: items([
        [can('tenant.settings.read') || can('tenant.payment_details.read'), '/settings', 'Settings'],
        [can('tenant.audit.read'), '/audit', 'Audit log'],
        [true, '/account', 'My account'],
      ]),
    },
  ];
  const search = can('tenant.users.read')
    ? { action: '/students', name: 'search', placeholder: 'Search students by surname' }
    : undefined;

  return (
    <>
      <BrandStyle color={publicSite?.primaryColor} />
      <ConsoleShell site={academy} caption="Academy portal" me={me} groups={groups} unread={unread} search={search}>
        <LiveBanner me={me} />
        {children}
      </ConsoleShell>
    </>
  );
}
