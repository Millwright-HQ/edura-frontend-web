import type { LedgerEntryDto, TenantDto, TenantOverviewDto } from '@edura/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { ActionButton, ModalForm } from '@/lib/action-form';
import { actionWords } from '@/lib/audit';
import { money, niceDate } from '@/lib/format';
import { callAsUser, getMe } from '@/lib/server';
import { Avatar, Field, Forbidden, None, PageHead, Panel, Pill, Row, Stat } from '@/lib/ui';
import { changeAdminAccess, changeTenantState, inviteAdmin, sendAdminLink } from '../actions';

interface AdminDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

const STATUS = {
  ACTIVE: { tone: 'good', label: 'Active' },
  SUSPENDED: { tone: 'bad', label: 'Suspended' },
  FAILED: { tone: 'bad', label: 'Setup failed' },
  PROVISIONING: { tone: 'warn', label: 'Setting up' },
} as const;

const LEDGER = {
  ISSUED: { tone: 'warn', label: 'Open' },
  PAID: { tone: 'good', label: 'Paid' },
  VOID: { tone: 'off', label: 'Void' },
} as const;

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));

export default async function TenantDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const [me, tenant, overview, admins, ledger, requestHeaders] = await Promise.all([
    getMe(),
    callAsUser<TenantDto>('tenants', `/tenants/${tenantId}`),
    callAsUser<TenantOverviewDto>('tenants', `/tenants/${tenantId}/overview`),
    callAsUser<AdminDto[]>('identity', `/tenants/${tenantId}/admins`),
    callAsUser<LedgerEntryDto[]>('tenants', `/ledger?tenantId=${tenantId}`),
    headers(),
  ]);
  if (tenant.status === 403) return <Forbidden what="this academy" />;
  if (!tenant.ok) notFound();

  const t = tenant.data;
  const can = (permission: string) => me.permissions.includes(permission);
  const scheme = requestHeaders.get('x-forwarded-proto') ?? 'http';
  const apex = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const address = `${t.slug}.${apex}`;
  const o = overview.ok ? overview.data : undefined;
  const people = o?.people;
  const adminList = admins.ok ? admins.data : [];
  const entries = ledger.ok ? ledger.data : [];
  const activeAdmins = adminList.filter((admin) => admin.status === 'ACTIVE').length;
  const live = t.status === 'ACTIVE' || t.status === 'SUSPENDED';

  return (
    <>
      <PageHead title={t.name} sub={<a href={`${scheme}://${address}`}>{address}</a>} back={{ href: '/tenants', label: 'Tenants' }}>
        <Pill tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Pill>
        {can('platform.tenants.create') && t.status === 'ACTIVE' && (
          <ModalForm label="Invite admin" buttonClassName="button-quiet" title="Invite an admin" description={t.name} action={inviteAdmin.bind(null, t.id)} submitLabel="Send invitation">
            <Field label="Email" name="email" type="email" />
            <div className="form-grid">
              <Field label="First name" name="firstName" />
              <Field label="Last name" name="lastName" />
            </div>
          </ModalForm>
        )}
        {can('platform.tenants.suspend') &&
          (t.status === 'ACTIVE' ? (
            <ModalForm
              label="Suspend"
              buttonClassName="button-danger"
              title={`Suspend ${t.name}?`}
              description="Nobody at this academy can sign in until you reinstate it. Their data is kept."
              action={changeTenantState.bind(null, t.id, 'suspend')}
              submitLabel="Suspend academy"
              submitClassName="button-danger"
              confirmWord={t.slug}
            />
          ) : t.status === 'SUSPENDED' ? (
            <ActionButton action={changeTenantState.bind(null, t.id, 'reinstate')} label="Reinstate" className="button" />
          ) : null)}
      </PageHead>

      {t.status === 'SUSPENDED' && <p className="notice notice-error">This academy is suspended. Nobody there can sign in.</p>}
      {t.failureReason && <p className="notice notice-error">Setup problem: {t.failureReason}</p>}

      <div className="stats">
        <Stat value={people?.activeStudents ?? 0} label="Active students" tone="primary" />
        <Stat value={people?.activeParents ?? 0} label="Active parents" tone="soft" />
        <Stat value={o?.billing.owing.length ? o.billing.owing.map((o) => money(o.cents, o.currency)).join(' + ') : money(0, 'AUD')} label="Owed to Edura" tone="tint" />
        <Stat value={o?.lastActivityAt ? when(o.lastActivityAt) : 'None yet'} label="Last activity" />
      </div>

      <div className="split">
        <Panel title="Details">
          <dl className="facts">
            <dt>Academy</dt>
            <dd>{t.name}</dd>
            <dt>Web address</dt>
            <dd>
              <a href={`${scheme}://${address}`}>{address}</a>
            </dd>
            <dt>Status</dt>
            <dd>{STATUS[t.status].label}</dd>
            <dt>Created</dt>
            <dd>{when(t.createdAt)}</dd>
            <dt>Last changed</dt>
            <dd>{when(t.updatedAt)}</dd>
            <dt>Academy ID</dt>
            <dd className="mono">{t.id}</dd>
            {people && (
              <>
                <dt>Deactivated people</dt>
                <dd>
                  {people.inactiveStudents} students, {people.inactiveParents} parents
                </dd>
                <dt>Waiting to join</dt>
                <dd>{people.pendingRequests} enrolment requests</dd>
              </>
            )}
          </dl>
        </Panel>

        <Panel title="Admins">
          {adminList.length === 0 ? (
            <None>No admin yet. Invite one so this academy can sign in.</None>
          ) : (
            <div className="rows">
              {adminList.map((admin) => (
                <Row
                  key={admin.id}
                  lead={<Avatar first={admin.firstName} last={admin.lastName} />}
                  title={
                    <>
                      {admin.firstName} {admin.lastName}{' '}
                      <Pill tone={admin.status === 'ACTIVE' ? 'good' : 'bad'}>{admin.status === 'ACTIVE' ? 'Has access' : 'Access revoked'}</Pill>
                    </>
                  }
                  sub={`${admin.email} · added ${niceDate(admin.createdAt.slice(0, 10))}`}
                  end={
                    can('platform.tenants.update') && (
                      <>
                        {admin.status === 'ACTIVE' ? (
                          <>
                            <ModalForm
                              label="Send password link"
                              buttonClassName="button-quiet button-sm"
                              title="Send a password link?"
                              description={`${admin.email} will get an email to choose a new password.`}
                              action={sendAdminLink.bind(null, t.id, admin.id)}
                              submitLabel="Send link"
                            />
                            <ModalForm
                              label="Revoke access"
                              buttonClassName="button-danger button-sm"
                              title={`Revoke ${admin.firstName}'s access?`}
                              description={
                                activeAdmins <= 1
                                  ? 'This is the only admin with access, so nobody at the academy will be able to manage it until you restore this one or invite another.'
                                  : 'They are signed out straight away and cannot sign in again until you restore access.'
                              }
                              action={changeAdminAccess.bind(null, t.id, admin.id, 'revoke')}
                              submitLabel="Revoke access"
                              submitClassName="button-danger"
                            />
                          </>
                        ) : (
                          <ModalForm
                            label="Restore access"
                            buttonClassName="button-quiet button-sm"
                            title={`Restore ${admin.firstName}'s access?`}
                            description="They can sign in again with their existing password."
                            action={changeAdminAccess.bind(null, t.id, admin.id, 'restore')}
                            submitLabel="Restore access"
                          />
                        )}
                      </>
                    )
                  }
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Invoices from Edura"
        action={
          can('platform.invoices.read') ? (
            <Link className="button-quiet button-sm" href="/ledger">
              Open ledger
            </Link>
          ) : undefined
        }
      >
        {entries.length === 0 ? (
          <None>Nothing has been invoiced to this academy.</None>
        ) : (
          <div className="rows">
            {entries.slice(0, 6).map((entry) => (
              <Row
                key={entry.id}
                title={
                  <>
                    {entry.number} <Pill tone={LEDGER[entry.status].tone}>{LEDGER[entry.status].label}</Pill>
                  </>
                }
                sub={`${entry.description || 'No description'} · due ${niceDate(entry.dueDate)}`}
                end={<strong>{money(entry.amountCents, entry.currency)}</strong>}
              />
            ))}
          </div>
        )}
        {o && o.billing.overdueCount > 0 && <p className="muted">{o.billing.overdueCount} overdue.</p>}
      </Panel>

      <Panel
        title="Recent activity"
        action={
          can('platform.audit.read') && live ? (
            <Link className="button-quiet button-sm" href={`/audit?tenantId=${t.id}`}>
              Full audit log
            </Link>
          ) : undefined
        }
      >
        {!o || o.recent.length === 0 ? (
          <None>No changes recorded yet.</None>
        ) : (
          <div className="rows">
            {o.recent.map((entry) => (
              <Row key={entry.id} title={actionWords(entry.action)} sub={`${entry.actorName} · ${when(entry.at)}`} />
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
