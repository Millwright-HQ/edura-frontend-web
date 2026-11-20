import type { AnnouncementDto, CourseDto, GroupDto } from '@edura/contracts';
import { ModalForm } from '@/lib/action-form';
import { shortDate } from '@/lib/format';
import { callAsUser, getMe } from '@/lib/server';
import { getTimezone } from '@/lib/site';
import { Field, IconTile, None, PageHead, Panel, Pill, Row, TextArea, Toggle } from '@/lib/ui';
import { deleteAnnouncement, postAnnouncement } from '../v1-actions';
import { AudiencePicker } from './audience-picker';

/** `sent` is one of: tenant, course, group, course:<id>, group:<id>. Empty means everything. */
function matchesFilter(item: AnnouncementDto, sent: string): boolean {
  if (!sent) return true;
  const [kind, id] = sent.split(':');
  if (item.audience !== kind) return false;
  return !id || item.audienceIds.includes(id);
}

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ sent?: string; q?: string }> }) {
  const [me, tz, params] = await Promise.all([getMe(), getTimezone(), searchParams]);
  const isStaff = me.permissions.includes('tenant.announcements.read');
  const canCreate = me.permissions.includes('tenant.announcements.create');
  const canDelete = me.permissions.includes('tenant.announcements.delete');
  const [list, groups, courses] = await Promise.all([
    callAsUser<AnnouncementDto[]>('comms', isStaff ? '/announcements' : '/me/announcements'),
    isStaff ? callAsUser<{ items: GroupDto[] }>('academic', '/groups?limit=100') : null,
    isStaff ? callAsUser<{ items: CourseDto[] }>('academic', '/courses?limit=100') : null,
  ]);
  const courseList = courses?.ok ? courses.data.items : [];
  const groupList = groups?.ok ? groups.data.items : [];
  const courseName = new Map(courseList.map((course) => [course.id, course.name]));
  const groupName = new Map(groupList.map((group) => [group.id, group.name]));

  const sent = params.sent ?? '';
  const needle = params.q?.trim().toLowerCase() ?? '';
  const all = list.ok ? list.data : [];
  const items = isStaff
    ? all
        .filter((item) => matchesFilter(item, sent))
        .filter((item) => !needle || `${item.title} ${item.body}`.toLowerCase().includes(needle))
    : all;
  const filtering = Boolean(sent || needle);

  /** Who an announcement went to, in words staff can scan. */
  const recipients = (item: AnnouncementDto) => {
    if (item.audience === 'tenant') return [<Pill key="all" tone="solid">Everyone</Pill>];
    const names = item.audience === 'course' ? courseName : groupName;
    return item.audienceIds.map((id) => (
      <Pill key={id} tone="off">
        {item.audience === 'course' ? 'Course' : 'Group'}: {names.get(id) ?? 'Removed'}
      </Pill>
    ));
  };

  return (
    <>
      <PageHead title="Announcements">
        {canCreate && (
          <ModalForm label="New announcement" title="New announcement" action={postAnnouncement} submitLabel="Post">
            <Field label="Title" name="title" />
            <TextArea label="Message" name="body" rows={5} maxLength={5000} />
            <AudiencePicker
              courses={courseList.map((course) => ({ value: course.id, label: course.name }))}
              groups={groupList.map((group) => ({ value: group.id, label: group.name }))}
            />
            <Toggle label="Also email this" name="sendEmail" hint="Each student’s parents get it, or the student when they have no parent." defaultChecked />
          </ModalForm>
        )}
      </PageHead>
      {isStaff && (
        <form className="filters" method="get">
          <label className="field">
            <span>Sent to</span>
            <select name="sent" defaultValue={sent}>
              <option value="">Everyone and everything</option>
              <option value="tenant">Everyone (whole academy)</option>
              <option value="course">Any course</option>
              <option value="group">Any group</option>
              {courseList.length > 0 && (
                <optgroup label="A specific course">
                  {courseList.map((course) => (
                    <option key={course.id} value={`course:${course.id}`}>
                      {course.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {groupList.length > 0 && (
                <optgroup label="A specific group">
                  {groupList.map((group) => (
                    <option key={group.id} value={`group:${group.id}`}>
                      {group.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <label className="field">
            <span>Search</span>
            <input type="search" name="q" defaultValue={params.q ?? ''} placeholder="Title or message" />
          </label>
          <button className="button" type="submit">
            Apply
          </button>
          {filtering && (
            <a className="button-quiet" href="/announcements">
              Clear
            </a>
          )}
        </form>
      )}
      <Panel>
        {items.length === 0 ? (
          <None>{filtering ? 'No announcements match these filters.' : 'No announcements yet.'}</None>
        ) : (
          <div className="rows">
            {items.map((item, index) => (
              <Row
                key={item.id}
                lead={<IconTile name="mega" alt={index % 2 === 1} />}
                title={item.title}
                sub={
                  <>
                    <span className="prose">{item.body}</span>
                    <br />
                    <span className="small">Posted {shortDate(item.publishedAt, tz)}</span>
                    {isStaff && (
                      <>
                        <br />
                        <span className="chips">
                          <span className="small">Sent to</span> {recipients(item)}
                        </span>
                      </>
                    )}
                  </>
                }
                end={
                  canDelete && (
                    <ModalForm
                      label="Delete"
                      buttonClassName="button-danger button-sm"
                      title={`Delete “${item.title}”?`}
                      description="It disappears for everyone."
                      action={deleteAnnouncement.bind(null, item.id)}
                      submitLabel="Delete"
                      submitClassName="button-danger"
                    />
                  )
                }
              />
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
