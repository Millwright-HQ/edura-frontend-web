import type { LedgerEntryDto, TenantDto } from '@edura/contracts';
import { ModalForm } from '@/lib/action-form';
import { money, niceDate } from '@/lib/format';
import { callAsUser, getMe } from '@/lib/server';
import { Field, Forbidden, None, PageHead, Panel, Pill, Select, Tabs } from '@/lib/ui';
import { closeEntry, createEntry } from './actions';

const PILL = {
  ISSUED: { tone: 'warn', label: 'Open' },
  PAID: { tone: 'good', label: 'Paid' },
  VOID: { tone: 'off', label: 'Void' },
} as const;

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [me, entries, tenants, params] = await Promise.all([
    getMe(),
    callAsUser<LedgerEntryDto[]>('tenants', '/ledger'),
    callAsUser<{ items: TenantDto[] }>('tenants', '/tenants?limit=100'),
    searchParams,
  ]);
  if (entries.status === 403) return <Forbidden what="the invoice ledger" />;
  const can = (action: string) => me.permissions.includes(`platform.invoices.${action}`);
  const list = (entries.ok ? entries.data : []).filter((entry) => !params.status || entry.status === params.status);

  return (
    <>
      <PageHead title="Tenant invoices" sub="A record of what academies owe Edura. Nothing is charged from here.">
        {can('create') && (
          <ModalForm label="Record an invoice" title="Record an invoice" action={createEntry} submitLabel="Record">
            <Select label="Tenant" name="tenantId" options={(tenants.ok ? tenants.data.items : []).map((t) => ({ value: t.id, label: t.name }))} />
            <Field label="Description" name="description" required={false} hint="Optional." />
            <div className="form-grid">
              <Field label="Amount" name="amount" type="number" step="0.01" />
              <Field label="Currency" name="currency" defaultValue="AUD" />
              <Field label="Issue date" name="issueDate" type="date" />
              <Field label="Due date" name="dueDate" type="date" />
            </div>
          </ModalForm>
        )}
      </PageHead>
      <Tabs
        label="Status"
        items={[
          { href: '/ledger', label: 'All', current: !params.status },
          { href: '/ledger?status=ISSUED', label: 'Open', current: params.status === 'ISSUED' },
          { href: '/ledger?status=PAID', label: 'Paid', current: params.status === 'PAID' },
          { href: '/ledger?status=VOID', label: 'Void', current: params.status === 'VOID' },
        ]}
      />
      {list.length === 0 ? (
        <Panel>
          <None>Nothing recorded here.</None>
        </Panel>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Number</th>
                <th scope="col">Academy</th>
                <th scope="col">Description</th>
                <th scope="col">Due</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((entry) => (
                <tr key={entry.id}>
                  <td className="strong nowrap">{entry.number}</td>
                  <td>{entry.tenantName}</td>
                  <td>{entry.description || <span className="muted">—</span>}</td>
                  <td className="nowrap">{niceDate(entry.dueDate)}</td>
                  <td className="strong nowrap">{money(entry.amountCents, entry.currency)}</td>
                  <td>
                    <Pill tone={PILL[entry.status].tone}>{PILL[entry.status].label}</Pill>
                  </td>
                  <td>
                    {entry.status === 'ISSUED' && (
                      <div className="td-actions">
                        {can('update') && (
                          <ModalForm
                            label="Mark paid"
                            buttonClassName="button-quiet button-sm"
                            title={`Mark ${entry.number} as paid?`}
                            description={`${entry.tenantName} paid ${money(entry.amountCents, entry.currency)}. This closes the invoice and can't be undone.`}
                            action={closeEntry.bind(null, entry.id, 'mark-paid')}
                            submitLabel="Yes, it's paid"
                          />
                        )}
                        {can('void') && (
                          <ModalForm label="Void" buttonClassName="button-danger button-sm" title={`Void ${entry.number}?`} description="It stays on record but no longer counts as owed." action={closeEntry.bind(null, entry.id, 'void')} submitLabel="Void" submitClassName="button-danger" />
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
