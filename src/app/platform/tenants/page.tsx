import type { AcademyRequestDto, TenantDto } from '@edura/contracts';
import Link from 'next/link';
import { headers } from 'next/headers';
import { ActionButton, ModalForm } from '@/lib/action-form';
import { callAsUser, getMe } from '@/lib/server';
import { Avatar, Field, Forbidden, None, PageHead, Panel, Pill, Row, Stat, Tabs } from '@/lib/ui';
import { approveAcademy, changeTenantState, createTenant, declineAcademy, inviteAdmin } from './actions';

const STATE_ACTION = {
  ACTIVE: { verb: 'suspend', label: 'Suspend', permission: 'platform.tenants.suspend' },
  SUSPENDED: { verb: 'reinstate', label: 'Reinstate', permission: 'platform.tenants.suspend' },
  FAILED: { verb: 'provision', label: 'Retry setup', permission: 'platform.tenants.create' },
  PROVISIONING: { verb: 'provision', label: 'Retry setup', permission: 'platform.tenants.create' },
} as const;

const STATUS_PILL = {
  ACTIVE: { tone: 'good', label: 'Active' },
  SUSPENDED: { tone: 'bad', label: 'Suspended' },
  FAILED: { tone: 'bad', label: 'Setup failed' },
  PROVISIONING: { tone: 'warn', label: 'Setting up' },
} as const;

const created = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ status?: string; search?: string }> }) {
  const [me, result, requests, requestHeaders, params] = await Promise.all([
    getMe(),
    callAsUser<{ items: TenantDto[] }>('tenants', '/tenants?limit=100'),
    callAsUser<AcademyRequestDto[]>('tenants', '/academy-requests'),
    headers(),
    searchParams,
  ]);
  if (result.status === 403) return <Forbidden what="viewing tenants" />;

  const canCreate = me.permissions.includes('platform.tenants.create');
  const scheme = requestHeaders.get('x-forwarded-proto') ?? 'http';
  const apex = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const all = result.ok ? result.data.items : [];
  const count = (status: TenantDto['status']) => all.filter((tenant) => tenant.status === status).length;
  const needle = params.search?.trim().toLowerCase() ?? '';
  const tenants = all
    .filter((tenant) => !params.status || tenant.status === params.status)
    .filter((tenant) => !needle || `${tenant.name} ${tenant.slug}`.toLowerCase().includes(needle));
  const pending = requests.ok ? requests.data : [];

  return (
    <>
      <PageHead title="Tenants" sub="Every academy on Edura.">
        {canCreate && (
          <ModalForm label="New tenant" title="New tenant" action={createTenant} submitLabel="Create tenant">
            <Field label="Name" name="name" />
            <Field label="Web address" name="slug" placeholder="academy" hint={`Becomes academy.${apex}. It can’t be changed later.`} />
          </ModalForm>
        )}
      </PageHead>
      <div className="stats">
        <Stat value={count('ACTIVE')} label="Active" tone="primary" />
        <Stat value={count('PROVISIONING') + count('FAILED')} label="Setting up" tone="soft" />
        <Stat value={count('SUSPENDED')} label="Suspended" tone="tint" />
        <Stat value={pending.length} label="Academy requests" />
      </div>
      {pending.length > 0 && (
        <Panel title="Academy requests">
          <div className="rows">
            {pending.map((request) => (
              <Row
                key={request.id}
                lead={<Avatar first={request.firstName} last={request.lastName} />}
                title={request.name}
                sub={`${request.slug}.${apex} · ${request.firstName} ${request.lastName} · ${request.email} · ${created(request.createdAt)}`}
                end={
                  canCreate && (
                    <>
                      <ModalForm
                        label="Approve"
                        buttonClassName="button button-sm"
                        title={`Create ${request.name}?`}
                        description={`${request.email} will get an email to choose a password.`}
                        action={approveAcademy.bind(null, request)}
                        submitLabel="Create academy"
                      />
                      <ActionButton action={declineAcademy.bind(null, request.id)} label="Decline" className="button-danger button-sm" />
                    </>
                  )
                }
              />
            ))}
          </div>
        </Panel>
      )}
      <div className="toolbar">
        <Tabs
          label="Status"
          items={[
            { href: '/tenants', label: 'All', current: !params.status },
            { href: '/tenants?status=ACTIVE', label: 'Active', current: params.status === 'ACTIVE' },
            { href: '/tenants?status=SUSPENDED', label: 'Suspended', current: params.status === 'SUSPENDED' },
          ]}
        />
      </div>
      {tenants.length === 0 ? (
        <Panel>
          <None>No tenants here.</None>
        </Panel>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Academy</th>
                <th scope="col">Address</th>
                <th scope="col">Created</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => {
                const state = STATE_ACTION[tenant.status];
                const canChange = me.permissions.includes(state.permission);
                const [first = '', second = ''] = tenant.name.split(' ');
                return (
                  <tr key={tenant.id}>
                    <td>
                      <span className="cell-person strong">
                        <Avatar first={first} last={second} />
                        <Link href={`/tenants/${tenant.id}`}>{tenant.name}</Link>
                      </span>
                    </td>
                    <td>
                      <a href={`${scheme}://${tenant.slug}.${apex}`}>
                        {tenant.slug}.{apex}
                      </a>
                    </td>
                    <td className="nowrap">{created(tenant.createdAt)}</td>
                    <td>
                      <Pill tone={STATUS_PILL[tenant.status].tone}>{STATUS_PILL[tenant.status].label}</Pill>
                    </td>
                    <td>
                      <div className="td-actions">
                        {canCreate && tenant.status === 'ACTIVE' && (
                          <ModalForm label="Invite admin" buttonClassName="button-quiet button-sm" title="Invite an admin" description={tenant.name} action={inviteAdmin.bind(null, tenant.id)} submitLabel="Send invitation">
                            <Field label="Email" name="email" type="email" />
                            <div className="form-grid">
                              <Field label="First name" name="firstName" />
                              <Field label="Last name" name="lastName" />
                            </div>
                          </ModalForm>
                        )}
                        {canChange &&
                          (tenant.status === 'ACTIVE' ? (
                            <ModalForm
                              label="Suspend"
                              buttonClassName="button-danger button-sm"
                              title={`Suspend ${tenant.name}?`}
                              description="Nobody at this academy can sign in until you reinstate it. Their data is kept."
                              action={changeTenantState.bind(null, tenant.id, 'suspend')}
                              submitLabel="Suspend academy"
                              submitClassName="button-danger"
                              confirmWord={tenant.slug}
                            />
                          ) : (
                            <ActionButton action={changeTenantState.bind(null, tenant.id, state.verb)} label={state.label} />
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
