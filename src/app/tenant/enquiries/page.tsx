import { ENQUIRY_STATUSES, type EnquiryDto, type EnquiryStatus } from '@edura/contracts';
import { ActionButton } from '@/lib/action-form';
import { shortDate } from '@/lib/format';
import { callAsUser, getMe } from '@/lib/server';
import { getTimezone } from '@/lib/site';
import { Avatar, Forbidden, None, PageHead, Panel, Row, Tabs } from '@/lib/ui';
import { setEnquiryStatus } from '../v1-actions';

const LABEL: Record<EnquiryStatus, string> = { new: 'New', contacted: 'Contacted', converted: 'Became a student', closed: 'Closed' };

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [me, params, tz] = await Promise.all([getMe(), searchParams, getTimezone()]);
  const status = ENQUIRY_STATUSES.find((s) => s === params.status) ?? 'new';
  const result = await callAsUser<EnquiryDto[]>('comms', `/enquiries?status=${status}`);
  if (result.status === 403) return <Forbidden what="enquiries" />;
  const canUpdate = me.permissions.includes('tenant.inquiries.update');
  const items = result.ok ? result.data : [];

  return (
    <>
      <PageHead title="Enquiries" sub="From your website." />
      <Tabs label="Status" items={ENQUIRY_STATUSES.map((s) => ({ href: `/enquiries?status=${s}`, label: LABEL[s], current: s === status }))} />
      <Panel>
        {items.length === 0 ? (
          <None>Nothing here.</None>
        ) : (
          <div className="rows">
            {items.map((enquiry) => {
              const [first = '', last = ''] = enquiry.name.split(' ');
              return (
                <Row
                  key={enquiry.id}
                  lead={<Avatar first={first} last={last} />}
                  title={enquiry.name}
                  sub={
                    <>
                      {enquiry.email}
                      {enquiry.phone ? ` · ${enquiry.phone}` : ''} · {shortDate(enquiry.createdAt, tz)}
                      <br />
                      <span className="prose">“{enquiry.message}”</span>
                    </>
                  }
                  end={
                    canUpdate &&
                    ENQUIRY_STATUSES.filter((s) => s !== status).map((s) => (
                      <ActionButton key={s} action={setEnquiryStatus.bind(null, enquiry.id, s)} label={`Move to ${LABEL[s]}`} />
                    ))
                  }
                />
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
