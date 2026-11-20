import {
  INVOICE_STATUSES,
  type BillableFamilyDto,
  type GroupDto,
  type InvoiceDto,
  type InvoiceStatsDto,
  type ParentInvoicesDto,
  type PaymentDetailsDto,
  type PersonDto,
} from '@edura/contracts';
import Link from 'next/link';
import { ActionButton, ActionForm, Modal, ModalForm } from '@/lib/action-form';
import { money, monthIn, monthTitle, niceDate, todayIn } from '@/lib/format';
import { callAsUser, getMe, type Me } from '@/lib/server';
import { getTimezone } from '@/lib/site';
import { Field, Forbidden, None, PageHead, Panel, Pill, Select, Stat, Tabs } from '@/lib/ui';
import { createGroupInvoices, createInvoice, invoiceAction, rejectReceipt, remindInvoice } from '../v1-actions';
import { GroupInvoiceFields } from './group-invoice-fields';
import { ReceiptUpload } from './receipt-upload';

/** 2026-11 plus or minus whole months. */
function shiftMonth(month: string, by: number): string {
  const [year, value] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year!, value! - 1 + by, 1));
  return date.toISOString().slice(0, 7);
}

const shortMonth = (month: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'short', year: 'numeric' }).format(new Date(`${month}-01T00:00:00Z`));

const LABEL: Record<string, string> = { PENDING: 'Unpaid', OVERDUE: 'Overdue', PAID: 'Paid', CANCELLED: 'Cancelled' };

function StatusPill({ invoice }: { invoice: InvoiceDto }) {
  const open = invoice.status === 'PENDING' || invoice.status === 'OVERDUE';
  if (open && invoice.receipt?.status === 'SUBMITTED') return <Pill tone="solid">Receipt to check</Pill>;
  if (open && invoice.receipt?.status === 'REJECTED') return <Pill tone="bad">Receipt rejected</Pill>;
  const tone = invoice.status === 'PAID' ? 'good' : invoice.status === 'OVERDUE' ? 'bad' : invoice.status === 'CANCELLED' ? 'off' : 'warn';
  return <Pill tone={tone}>{LABEL[invoice.status]}</Pill>;
}

function InvoiceFields({ month, today }: { month: string; today: string }) {
  return (
    <>
      <Field label="Description" name="description" />
      <div className="form-grid">
        <Field label="Amount" name="amount" type="number" step="0.01" />
        <Field label="Billing month" name="periodMonth" type="month" defaultValue={month} />
        <Field label="Issue date" name="issueDate" type="date" defaultValue={today} />
        <Field label="Due date" name="dueDate" type="date" />
      </div>
    </>
  );
}

async function FamilyInvoices({ me, params }: { me: Me; params: Record<string, string | undefined> }) {
  const query = new URLSearchParams();
  if (INVOICE_STATUSES.includes(params.status as never)) query.set('status', params.status!);
  if (params.month) query.set('month', params.month);
  if (params.child) query.set('studentId', params.child);
  const [result, how, family] = await Promise.all([
    callAsUser<ParentInvoicesDto>('billing', `/me/invoices?${query}`),
    callAsUser<PaymentDetailsDto | null>('billing', '/me/how-to-pay'),
    callAsUser<{ children: PersonDto[] }>('identity', '/me/family'),
  ]);
  if (!result.ok) return <Forbidden what="invoices" />;
  const data = result.data;
  const currency = how.ok && how.data ? how.data.currency : '';
  const children = family.ok ? family.data.children : [];

  return (
    <>
      <PageHead title="Invoices" />
      <div className="stats">
        <Stat value={money(data.outstandingCents, currency)} label={`Outstanding${data.nextDueDate ? ` · next due ${niceDate(data.nextDueDate)}` : ''}`} tone="tint" />
        <Stat value={money(data.overdueCents, currency)} label="Overdue" />
        <Stat value={money(data.paidThisYearCents, currency)} label="Paid this year" tone="soft" />
      </div>
      <div className="toolbar">
        <form className="search" action="/invoices">
          {me.kind === 'parent' && (
            <select name="child" defaultValue={params.child ?? ''} aria-label="Child">
              <option value="">All children</option>
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.firstName}
                </option>
              ))}
            </select>
          )}
          <select name="status" defaultValue={params.status ?? ''} aria-label="Status">
            <option value="">Any status</option>
            {INVOICE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {LABEL[status]}
              </option>
            ))}
          </select>
          <input name="month" type="month" defaultValue={params.month} aria-label="Month" />
          <button className="button-quiet" type="submit">
            Filter
          </button>
        </form>
      </div>
      <div className="cols cols-main">
        {data.invoices.length === 0 ? (
          <Panel>
            <None>No invoices here.</None>
          </Panel>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Invoice</th>
                  <th scope="col">Student</th>
                  <th scope="col">Due</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((invoice) => {
                  const open = invoice.status === 'PENDING' || invoice.status === 'OVERDUE';
                  return (
                    <tr key={invoice.id}>
                      <td>
                        <span className="strong">{invoice.description}</span>
                        <small>
                          {invoice.number} · {shortMonth(invoice.periodMonth)}
                        </small>
                        {invoice.receipt?.status === 'REJECTED' && <small>Not accepted: {invoice.receipt.reason}</small>}
                      </td>
                      <td>{invoice.students.map((s) => s.name.split(' ')[0]).join(', ')}</td>
                      <td className="nowrap">{niceDate(invoice.dueDate)}</td>
                      <td className="strong nowrap">{money(invoice.amountCents, invoice.currency)}</td>
                      <td>
                        <StatusPill invoice={invoice} />
                      </td>
                      <td>
                        <div className="td-actions">
                          {open && invoice.receipt?.status !== 'SUBMITTED' && (
                            <ReceiptUpload invoiceId={invoice.id} number={invoice.number} again={invoice.receipt?.status === 'REJECTED'} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {how.ok && how.data && (
          <Panel title="How to pay">
            <p className="muted">Transfer the amount, then upload your receipt.</p>
            <dl className="facts">
              <dt>Account</dt>
              <dd>{how.data.accountName}</dd>
              <dt>Bank</dt>
              <dd>{how.data.bankName}</dd>
              <dt>BSB</dt>
              <dd>{how.data.bsb}</dd>
              <dt>Number</dt>
              <dd>{how.data.accountNumber}</dd>
              <dt>Reference</dt>
              <dd>Your invoice number</dd>
            </dl>
            {how.data.instructions && <p className="muted small prose">{how.data.instructions}</p>}
          </Panel>
        )}
      </div>
    </>
  );
}

async function StaffInvoices({ me, params, month, today }: { me: Me; params: Record<string, string | undefined>; month: string; today: string }) {
  const can = (action: string) => me.permissions.includes(`tenant.invoices.${action}`);
  const toCheck = params.status === 'receipts';
  const query = new URLSearchParams({ month });
  if (INVOICE_STATUSES.includes(params.status as never)) query.set('status', params.status!);
  if (params.search) query.set('search', params.search);
  const [result, stats, groups, billable] = await Promise.all([
    callAsUser<InvoiceDto[]>('billing', `/invoices?${query}`),
    callAsUser<InvoiceStatsDto>('billing', `/invoices/stats?month=${month}`),
    callAsUser<{ items: GroupDto[] }>('academic', '/groups?limit=100'),
    can('create') ? callAsUser<BillableFamilyDto[]>('identity', '/users/billable') : null,
  ]);
  if (result.status === 403) return <Forbidden what="invoices" />;
  const currency = result.ok ? (result.data[0]?.currency ?? '') : '';
  const groupFilter = params.group ?? '';
  const invoices = (result.ok ? result.data : [])
    .filter((invoice) => !toCheck || invoice.receipt?.status === 'SUBMITTED')
    .filter((invoice) => !groupFilter || invoice.groups.some((group) => group.id === groupFilter) || invoice.groupId === groupFilter);
  const groupList = groups.ok ? groups.data.items : [];
  /** A link to this page with some filters changed and the rest kept. */
  const href = (over: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { month, status: params.status, search: params.search, group: params.group, ...over };
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(merged)) if (value) query.set(name, value);
    return `/invoices?${query}`;
  };
  const tabHref = (status?: string) => href({ status });
  // Who pays for each student, so the group invoice form can show families sharing one invoice.
  const billTo: Record<string, string> = {};
  for (const family of billable?.ok ? billable.data : []) {
    for (const studentId of family.studentIds) if (studentId !== family.billToId) billTo[studentId] = family.name;
  }

  return (
    <>
      <PageHead title="Invoices" sub="Billing for the month shown below.">
        {can('create') && (
          <>
            <ModalForm label="Group invoices" buttonClassName="button-quiet" title="Group invoices" description="The amount is per student. Brothers and sisters with the same parent get one invoice for the total. Anyone already billed for this group and month is skipped." action={createGroupInvoices} submitLabel="Send group invoices" wide>
              <GroupInvoiceFields groups={groupList.map((g) => ({ value: g.id, label: g.name }))} billTo={billTo} />
              <InvoiceFields month={month} today={today} />
            </ModalForm>
            <ModalForm label="New invoice" title="New invoice" action={createInvoice} submitLabel="Send invoice">
              <Select
                label="Bill to"
                name="family"
                options={(billable?.ok ? billable.data : []).map((family) => ({
                  value: [family.billToId, ...family.studentIds].join(','),
                  label: family.studentIds[0] === family.billToId ? `${family.name} (student, no parent)` : `${family.name} (${family.studentNames.join(', ')})`,
                }))}
              />
              <InvoiceFields month={month} today={today} />
            </ModalForm>
          </>
        )}
      </PageHead>
      {stats.ok && (
        <div className="stats">
          <Stat value={money(stats.data.pendingCents, currency)} label="Pending" tone="tint" />
          <Stat value={money(stats.data.overdueCents, currency)} label="Overdue" tone="accent" />
          <Stat value={money(stats.data.paidCents, currency)} label={`Paid (${stats.data.collectedPercent}%)`} tone="soft" />
        </div>
      )}
      <div className="month-nav">
        <Link className="button-quiet button-sm" href={href({ month: shiftMonth(month, -1) })} aria-label={`Previous month, ${monthTitle(shiftMonth(month, -1))}`}>
          ‹ {shortMonth(shiftMonth(month, -1))}
        </Link>
        <h2>{monthTitle(month)}</h2>
        <Link className="button-quiet button-sm" href={href({ month: shiftMonth(month, 1) })} aria-label={`Next month, ${monthTitle(shiftMonth(month, 1))}`}>
          {shortMonth(shiftMonth(month, 1))} ›
        </Link>
        <form className="search" action="/invoices">
          {params.status && <input type="hidden" name="status" value={params.status} />}
          {params.search && <input type="hidden" name="search" value={params.search} />}
          {params.group && <input type="hidden" name="group" value={params.group} />}
          <input name="month" type="month" defaultValue={month} aria-label="Jump to month" required />
          <button className="button-quiet" type="submit">
            Go to month
          </button>
        </form>
      </div>
      <div className="toolbar">
        <Tabs
          label="Status"
          items={[
            { href: tabHref(), label: 'All', current: !params.status },
            { href: tabHref('receipts'), label: 'Receipts to check', current: toCheck },
            ...INVOICE_STATUSES.map((status) => ({ href: tabHref(status), label: LABEL[status]!, current: params.status === status })),
          ]}
        />
        <form className="search" action="/invoices">
          <input type="hidden" name="month" value={month} />
          {params.status && <input type="hidden" name="status" value={params.status} />}
          <input name="search" defaultValue={params.search} placeholder="Number, parent or description" aria-label="Search invoices" />
          <select name="group" defaultValue={groupFilter} aria-label="Group">
            <option value="">All groups</option>
            {groupList.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <button className="button-quiet" type="submit">
            Filter
          </button>
        </form>
      </div>
      {invoices.length === 0 ? (
        <Panel>
          <None>No invoices here.</None>
        </Panel>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Invoice</th>
                <th scope="col">Month</th>
                <th scope="col">Family and students</th>
                <th scope="col">Due</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const open = invoice.status === 'PENDING' || invoice.status === 'OVERDUE';
                const waiting = invoice.receipt?.status === 'SUBMITTED';
                return (
                  <tr key={invoice.id}>
                    <td>
                      <span className="strong">{invoice.number}</span>
                      <small>{invoice.description}</small>
                      {invoice.reminders && (
                        <small>
                          Reminded {invoice.reminders.count} {invoice.reminders.count === 1 ? 'time' : 'times'}
                          {invoice.reminders.lastAt ? `, last ${niceDate(invoice.reminders.lastAt.slice(0, 10))}` : ''}
                        </small>
                      )}
                    </td>
                    <td className="nowrap">{shortMonth(invoice.periodMonth)}</td>
                    <td>
                      <span className="strong">{invoice.parentName}</span>
                      <ul className="kids">
                        {invoice.students.map((student) => (
                          <li key={student.id}>
                            {student.name}
                            {student.groupName && <Pill tone="off">{student.groupName}</Pill>}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="nowrap">{niceDate(invoice.dueDate)}</td>
                    <td className="strong nowrap">{money(invoice.amountCents, invoice.currency)}</td>
                    <td>
                      <StatusPill invoice={invoice} />
                    </td>
                    <td>
                      <div className="td-actions">
                        {open && can('mark_paid') && waiting && (
                          <Modal label="Review receipt" buttonClassName="button button-sm" title="Review receipt" description={`${invoice.number} · ${invoice.parentName} · ${money(invoice.amountCents, invoice.currency)}`}>
                            <a className="button-quiet" href={`/view-receipt/${invoice.id}`} target="_blank" rel="noreferrer">
                              Open {invoice.receipt!.fileName}
                            </a>
                            <ActionButton action={invoiceAction.bind(null, invoice.id, 'receipt/approve')} label="Approve receipt" className="button button-block" />
                            <section className="form-section">
                              <h3>Or reject it</h3>
                              <ActionForm action={rejectReceipt.bind(null, invoice.id)} submitLabel="Reject" submitClassName="button-danger">
                                <Field label="Reason (the parent sees this)" name="reason" />
                              </ActionForm>
                            </section>
                          </Modal>
                        )}
                        {invoice.status === 'OVERDUE' && can('update') && !waiting && (
                          <ModalForm
                            label="Send reminder"
                            buttonClassName="button-quiet button-sm"
                            title={`Remind ${invoice.parentName} about ${invoice.number}?`}
                            description={`${money(invoice.amountCents, invoice.currency)} was due ${niceDate(invoice.dueDate)}. They are emailed now. Reminders also go out by themselves: a day after the due date, then weekly, up to four.`}
                            action={remindInvoice.bind(null, invoice.id)}
                            submitLabel="Send reminder"
                          />
                        )}
                        {open && can('mark_paid') && !waiting && (
                          <ModalForm
                            label="Mark paid"
                            buttonClassName="button-quiet button-sm"
                            title={`Mark ${invoice.number} as paid?`}
                            description={`${invoice.parentName} paid ${money(invoice.amountCents, invoice.currency)} without uploading a receipt. This closes the invoice.`}
                            action={invoiceAction.bind(null, invoice.id, 'mark-paid')}
                            submitLabel="Yes, it was paid"
                          />
                        )}
                        {open && can('cancel') && (
                          <ModalForm
                            label="Cancel"
                            buttonClassName="button-danger button-sm"
                            title={`Cancel ${invoice.number}?`}
                            description="The family will no longer be asked to pay it."
                            action={invoiceAction.bind(null, invoice.id, 'cancel')}
                            submitLabel="Cancel invoice"
                            submitClassName="button-danger"
                          />
                        )}
                        {invoice.receipt && !waiting && (
                          <a className="button-quiet button-sm" href={`/view-receipt/${invoice.id}`} target="_blank" rel="noreferrer">
                            Receipt
                          </a>
                        )}
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

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [me, params, tz] = await Promise.all([getMe(), searchParams, getTimezone()]);
  if (me.kind === 'parent' || me.kind === 'student') return <FamilyInvoices me={me} params={params} />;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? '') ? params.month! : monthIn(tz);
  return <StaffInvoices me={me} params={params} month={month} today={todayIn(tz)} />;
}
