import type { AuditEntryDto, AuditPageDto } from '@edura/contracts';
import { monthTitle } from '@/lib/format';
import { None, Panel, Pill } from '@/lib/ui';

/** Plain words for every change we record. Anything new still reads fine through the fallback. */
const WORDS: Record<string, string> = {
  'tenant.create': 'Created the academy',
  'tenant.rename': 'Renamed the academy',
  'tenant.provision.retry': 'Retried the academy setup',
  'tenant.suspend': 'Suspended the academy',
  'tenant.reinstate': 'Reinstated the academy',
  'ledger.create': 'Recorded an invoice to the academy',
  'ledger.paid': 'Marked an academy invoice paid',
  'ledger.void': 'Voided an academy invoice',
  'academy_request.approved': 'Approved an academy request',
  'academy_request.declined': 'Declined an academy request',
  'user.student.create': 'Added a student',
  'user.parent.create': 'Added a parent',
  'user.link.create': 'Linked a parent to a student',
  'user.link.delete': 'Unlinked a parent from a student',
  'user.update': 'Edited a profile',
  'user.deactivate': 'Deactivated an account',
  'user.reactivate': 'Reactivated an account',
  'user.erase': 'Erased a person’s details',
  'staff.create': 'Added a staff member',
  'staff.roles.set': 'Changed a staff member’s roles',
  'staff.deactivate': 'Revoked a staff member’s access',
  'staff.reactivate': 'Restored a staff member’s access',
  'password.reset': 'Reset a password',
  'password.change': 'Changed their password',
  'password.admin_set': 'Set a password for someone',
  'password.link_sent': 'Sent a password link',
  'request.approve': 'Approved an enrolment request',
  'request.reject': 'Rejected an enrolment request',
  'role.create': 'Created a role',
  'role.update': 'Changed a role',
  'role.delete': 'Deleted a role',
  'group.create': 'Created a student group',
  'group.update': 'Edited a student group',
  'group.archive': 'Archived a student group',
  'group.reactivate': 'Reopened a student group',
  'group.student.add': 'Added a student to a group',
  'group.student.remove': 'Removed a student from a group',
  'group.teacher.add': 'Added a teacher to a group',
  'group.teacher.update': 'Changed a teacher’s rights in a group',
  'group.teacher.remove': 'Removed a teacher from a group',
  'course.create': 'Created a course',
  'course.update': 'Edited a course',
  'course.deactivate': 'Deactivated a course',
  'course.reactivate': 'Reactivated a course',
  'course.reorder': 'Reordered the courses',
  'week.create': 'Added a week',
  'week.update': 'Edited a week',
  'group.end': 'Set the date a group ends',
  'group.end_cancel': 'Took back the ending of a group',
  'course.end': 'Ended a course',
  'course.content_delete': 'Deleted the content of an ended course',
  'class.group_removed': 'Removed an ended group from a class',
  'week.hide': 'Hid a week from students',
  'week.show': 'Showed a week to students',
  'week.delete': 'Deleted a week',
  'content.upload': 'Uploaded material',
  'content.link': 'Added a link to a week',
  'content.update': 'Edited material',
  'content.delete': 'Deleted material',
  'content.reorder': 'Reordered material',
  'recording.file': 'Added a recording',
  'class.create': 'Scheduled a class',
  'class.update': 'Changed a class',
  'class.delete': 'Deleted a class',
  'attendance.mark': 'Marked attendance',
  'invoice.create': 'Created an invoice',
  'invoice.paid': 'Marked an invoice paid',
  'invoice.cancel': 'Cancelled an invoice',
  'invoice.merge': 'Combined invoices into one',
  'invoice.receipt.submit': 'Uploaded a payment receipt',
  'invoice.receipt.reject': 'Rejected a payment receipt',
  'payment_details.update': 'Changed the payment details',
  'announcement.create': 'Posted an announcement',
  'announcement.update': 'Edited an announcement',
  'announcement.delete': 'Deleted an announcement',
  'feedback.create': 'Wrote feedback',
  'feedback.update': 'Edited feedback',
  'feedback.delete': 'Deleted feedback',
  'enquiry.status': 'Updated an enquiry',
  'settings.site': 'Changed the site settings',
  'zoom.connect': 'Connected a Zoom account',
  'zoom.disconnect': 'Disconnected a Zoom account',
  'image.upload': 'Uploaded an image',
};

export function actionWords(action: string): string {
  const known = WORDS[action];
  if (known) return known;
  const spoken = action.replace(/[._]/g, ' ');
  return spoken.charAt(0).toUpperCase() + spoken.slice(1);
}

/** The areas the log can be narrowed to. Each is the start of an action name. */
const TENANT_AREAS = [
  ['user', 'Students and parents'],
  ['staff', 'Staff'],
  ['role', 'Roles'],
  ['request', 'Enrolment requests'],
  ['course', 'Courses'],
  ['week', 'Weeks'],
  ['content', 'Materials'],
  ['group', 'Student groups'],
  ['class', 'Classes'],
  ['attendance', 'Attendance'],
  ['invoice', 'Invoices'],
  ['announcement', 'Announcements'],
  ['feedback', 'Feedback'],
  ['settings', 'Settings'],
  ['zoom', 'Zoom'],
] as const;
const PLATFORM_AREAS = [
  ['tenant', 'Academies'],
  ['ledger', 'Academy invoices'],
  ['academy_request', 'Academy requests'],
  ...TENANT_AREAS,
] as const;

const stamp = (iso: string, timeZone?: string) =>
  new Intl.DateTimeFormat('en-GB', {
    ...(timeZone ? { timeZone } : {}),
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));

const aboutOf = (entry: AuditEntryDto): string | undefined => {
  if (entry.targetName) return entry.targetName;
  const number = entry.detail?.['number'];
  return typeof number === 'string' ? number : undefined;
};

/**
 * What was sent with the change, as stored: secrets were already hidden before it was saved. Shown as a
 * "Details" fold-out so the table stays readable.
 */
function Details({ detail }: { detail?: Record<string, unknown> | undefined }) {
  if (!detail || Object.keys(detail).length === 0) return <span className="muted">No details</span>;
  const { request, ...extra } = detail as { request?: { method?: string; route?: string; params?: unknown; body?: unknown; bodyOmitted?: string } } & Record<string, unknown>;
  const shown = {
    ...(Object.keys(extra).length > 0 ? { recorded: extra } : {}),
    ...(request?.params ? { target: request.params } : {}),
    ...(request?.body !== undefined ? { sent: request.body } : {}),
    ...(request?.bodyOmitted ? { sent: request.bodyOmitted } : {}),
  };
  return (
    <details className="audit-details">
      <summary>{request?.method ? `${request.method} ${request.route ?? ''}` : 'Details'}</summary>
      <pre>{JSON.stringify(shown, null, 2)}</pre>
    </details>
  );
}

export interface AuditFilters {
  month?: string | undefined;
  tenantId?: string | undefined;
  action?: string | undefined;
}

/**
 * The log itself, with filters. It is a plain GET form, so a filtered view can be bookmarked or shared.
 * `tenants` is given only on the platform, which is what turns on the academy column and filter.
 */
export function AuditView({
  page,
  filters,
  tenants,
  timeZone,
}: {
  page: AuditPageDto;
  filters: AuditFilters;
  tenants?: { id: string; name: string }[];
  timeZone?: string;
}) {
  const areas = tenants ? PLATFORM_AREAS : TENANT_AREAS;
  return (
    <>
      <form className="filters" method="get">
        <label className="field">
          <span>Month</span>
          <select name="month" defaultValue={page.month}>
            {page.months.map((month) => (
              <option key={month} value={month}>
                {monthTitle(month)}
              </option>
            ))}
          </select>
        </label>
        {tenants && (
          <label className="field">
            <span>Academy</span>
            <select name="tenantId" defaultValue={filters.tenantId ?? ''}>
              <option value="">All academies</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>What happened</span>
          <select name="action" defaultValue={filters.action ?? ''}>
            <option value="">Everything</option>
            {areas.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="button" type="submit">
          Apply
        </button>
      </form>
      {page.entries.length === 0 ? (
        <Panel>
          <None>Nothing was recorded for these filters in {monthTitle(page.month)}.</None>
        </Panel>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">When</th>
                {tenants && <th scope="col">Academy</th>}
                <th scope="col">Who</th>
                <th scope="col">What they did</th>
                {tenants && <th scope="col">Details</th>}
              </tr>
            </thead>
            <tbody>
              {page.entries.map((entry) => {
                const about = aboutOf(entry);
                return (
                  <tr key={`${entry.id}-${entry.tenantId ?? 'platform'}`}>
                    <td className="nowrap">{stamp(entry.at, timeZone)}</td>
                    {tenants && <td>{entry.tenantName ?? <span className="muted">Edura</span>}</td>}
                    <td>
                      <span className="strong">{entry.actorName}</span>{' '}
                      {entry.actorKind === 'platform' && tenants && <Pill tone="solid">Edura staff</Pill>}
                    </td>
                    <td>
                      {actionWords(entry.action)}
                      {about && <span className="muted"> · {about}</span>}
                    </td>
                    {tenants && (
                      <td>
                        <Details detail={entry.detail} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {page.truncated && (
        <p className="muted">Showing the newest {page.entries.length} entries. Narrow the filters to see older ones.</p>
      )}
    </>
  );
}
