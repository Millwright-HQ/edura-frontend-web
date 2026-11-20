import type { EnrolmentRequestDto, GroupDto, RequestStatus, UserStatsDto } from '@edura/contracts';
import Link from 'next/link';
import { ModalForm } from '@/lib/action-form';
import { callAsUser, getMe } from '@/lib/server';
import { Avatar, Field, Forbidden, None, PageHead, Panel, Row, Select, Tabs } from '@/lib/ui';
import { approveRequest, rejectRequest } from '../people-actions';

const TABS: { status: RequestStatus; label: string }[] = [
  { status: 'pending', label: 'Pending' },
  { status: 'approved', label: 'Approved' },
  { status: 'rejected', label: 'Rejected' },
];

const when = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cursor?: string }>;
}) {
  const [me, params] = await Promise.all([getMe(), searchParams]);
  const status = TABS.find((t) => t.status === params.status)?.status ?? 'pending';
  const query = new URLSearchParams({ status, limit: '25' });
  if (params.cursor) query.set('cursor', params.cursor);
  const canApprove = me.permissions.includes('tenant.requests.approve');
  const [result, stats, groups] = await Promise.all([
    callAsUser<{ items: EnrolmentRequestDto[]; nextCursor?: string }>('identity', `/requests?${query}`),
    callAsUser<UserStatsDto>('identity', '/users/stats'),
    canApprove && me.permissions.includes('tenant.groups.read') ? callAsUser<{ items: GroupDto[] }>('academic', '/groups?limit=100') : null,
  ]);
  const groupOptions = [{ value: '', label: 'No group yet' }, ...(groups?.ok ? groups.data.items.map((g) => ({ value: g.id, label: `${g.name} (${g.yearLevel})` })) : [])];
  const canPlace = groups?.ok === true && me.permissions.includes('tenant.groups.manage_students');

  if (result.status === 403) return <Forbidden what="enrolment requests" />;

  const canReject = me.permissions.includes('tenant.requests.reject');
  const items = result.ok ? result.data.items : [];

  return (
    <>
      <PageHead title="Enrolment requests" sub={stats.ok ? `${stats.data.pendingRequests} waiting for review` : undefined} />
      <Tabs label="Status" items={TABS.map((tab) => ({ href: `/requests?status=${tab.status}`, label: tab.label, current: tab.status === status }))} />
      <Panel>
        {items.length === 0 ? (
          <None>{result.ok ? 'No requests here.' : 'This list could not be loaded.'}</None>
        ) : (
          <div className="rows">
            {items.map((request) => {
              const applicant = request.parent ?? request.students[0]!;
              const name = `${applicant.firstName} ${applicant.lastName}`;
              const students = request.students.map((s) => `${s.firstName} ${s.lastName} (${s.email}${s.phone ? `, ${s.phone}` : ''})`).join(', ');
              return (
                <Row
                  key={request.id}
                  lead={<Avatar first={applicant.firstName} last={applicant.lastName} />}
                  title={request.parent ? name : `${name} (no parent)`}
                  sub={
                    <>
                      {request.parent ? `${request.parent.email}${request.parent.phone ? ` · ${request.parent.phone}` : ''} · ` : ''}
                      {request.students.length === 1 ? 'Student' : 'Students'}: {students} · {when(request.createdAt)}
                      {request.message ? ` · “${request.message}”` : ''}
                      {request.rejectionReason ? ` · Reason: ${request.rejectionReason}` : ''}
                    </>
                  }
                  end={
                    status === 'pending' ? (
                      <>
                        {canApprove && (
                          <ModalForm
                            label="Approve"
                            buttonClassName="button button-sm"
                            title="Approve and email the logins"
                            description={
                              request.parent
                                ? 'The parent and each student get their own login with a temporary password, each in a separate email. A parent who already has a login keeps it.'
                                : 'Each student gets their own login with a temporary password, by email.'
                            }
                            action={approveRequest.bind(null, request.id)}
                            submitLabel="Approve and send logins"
                          >
                            {canPlace && (
                              <Select
                                label={request.students.length === 1 ? 'Put the student in a group' : 'Put the students in a group'}
                                name="groupId"
                                options={groupOptions}
                                required={false}
                              />
                            )}
                          </ModalForm>
                        )}
                        {canReject && (
                          <ModalForm label="Reject" buttonClassName="button-danger button-sm" title={`Reject ${name}’s request?`} action={rejectRequest.bind(null, request.id)} submitLabel="Reject request" submitClassName="button-danger">
                            <Field label="Reason (optional, kept for your records)" name="reason" required={false} maxLength={300} />
                          </ModalForm>
                        )}
                      </>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </Panel>
      {result.ok && result.data.nextCursor && (
        <p>
          <Link href={`/requests?status=${status}&cursor=${result.data.nextCursor}`}>Next page</Link>
        </p>
      )}
    </>
  );
}
