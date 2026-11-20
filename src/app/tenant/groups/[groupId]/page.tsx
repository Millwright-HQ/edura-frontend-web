import { GROUP_PERMISSIONS, GROUP_PERMISSION_LABELS, type CourseDto, type GroupDetailDto, type PersonDto } from '@edura/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckList, ModalForm } from '@/lib/action-form';
import { callAsUser, getMe } from '@/lib/server';
import { getTimezone } from '@/lib/site';
import { monthRange, shortDate, todayIn } from '@/lib/format';
import { Avatar, Checks, Field, Forbidden, FormSection, IconTile, None, PageHead, Panel, Pill, Row, Select, TextArea, Toggle } from '@/lib/ui';
import { addGroupStudents, addTeacherToGroup, assignTeacher, cancelGroupEnd, endGroup, removeGroupStudent, removeTeacher, setGroupActive, updateGroup } from '../../academic-actions';
import { CoursePicker } from '../course-picker';

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const [me, result, courses] = await Promise.all([
    getMe(),
    callAsUser<GroupDetailDto>('academic', `/groups/${groupId}`),
    callAsUser<{ items: CourseDto[] }>('academic', '/courses?limit=100'),
  ]);
  if (result.status === 403) return <Forbidden what="student groups" />;
  if (!result.ok) notFound();

  const group = result.data;
  const active = group.status === 'ACTIVE';
  const timezone = await getTimezone();
  const ended = group.accessEndsAt !== undefined && group.accessEndsAt <= new Date().toISOString();
  const can = (permission: string) => me.permissions.includes(permission);
  const canManage = can('tenant.groups.manage_students');
  const candidates =
    canManage && active && can('tenant.users.read')
      ? await callAsUser<{ items: PersonDto[] }>('identity', '/users?kind=student&limit=100')
      : null;
  const staff =
    can('tenant.groups.update') && can('tenant.staff.read')
      ? await callAsUser<{ items: { id: string; firstName: string; lastName: string; roleIds: string[] }[] }>('identity', '/staff?limit=100')
      : null;
  const taken = new Set(group.teachers.map((teacher) => teacher.id));
  const teachable = staff?.ok ? staff.data.items.filter((person) => person.roleIds.includes('tenant_teacher') && !taken.has(person.id)) : [];
  const permissionOptions = GROUP_PERMISSIONS.map((value) => ({ value, label: GROUP_PERMISSION_LABELS[value] }));
  const inGroup = new Set(group.members.map((member) => member.id));
  const addable = candidates?.ok ? candidates.data.items.filter((s) => !inGroup.has(s.id)) : [];

  // A linked course that was deactivated must still be offered, or saving would drop it.
  const options = [
    ...(courses.ok ? courses.data.items : []),
    ...group.courses.filter((c) => !courses.ok || !courses.data.items.some((o) => o.id === c.id)),
  ];

  return (
    <>
      <PageHead
        title={group.name}
        sub={`${group.yearLevel} · ${monthRange(group.startMonth, group.endMonth)} · ${group.memberCount} students${active ? '' : ' · Archived'}`}
        back={{ href: '/groups', label: 'Student groups' }}
      >
        {can('tenant.groups.deactivate') && active && group.accessEndsAt && (
          <ModalForm
            label="Cancel ending"
            buttonClassName="button-quiet"
            title="Cancel the ending?"
            description="Students keep access and the group carries on. Classes already taken off the calendar are not put back."
            action={cancelGroupEnd.bind(null, group.id)}
            submitLabel="Cancel the ending"
          />
        )}
        {can('tenant.groups.deactivate') && active && !ended && (
          <ModalForm
            label={group.accessEndsAt ? 'Change end date' : 'End group'}
            buttonClassName="button-danger"
            title={`End ${group.name}`}
            description="On the date you choose, students lose this group’s course materials and classes. They can still sign in and see their results, and parents still see invoices."
            action={endGroup.bind(null, group.id, group.name, group.courses.map((c) => c.name))}
            submitLabel="End the group"
            submitClassName="button-danger"
            wide
          >
            <Field label="Access ends on" name="endDate" type="date" defaultValue={todayIn(timezone)} />
            <FormSection title="Tell the students and families">
              <Toggle label="Send an announcement now" name="notify" defaultChecked hint="Goes to the group’s students and their parents, by notification and email. The date and the affected courses are added for you." />
              <Field label="Subject" name="subject" defaultValue={`${group.name} is ending`} />
              <TextArea
                label="Message"
                name="message"
                rows={4}
                maxLength={3000}
                defaultValue={`This student group is coming to an end. Please finish anything you need from its course materials before access closes.`}
              />
            </FormSection>
          </ModalForm>
        )}
        {can('tenant.groups.deactivate') && (
          <ModalForm
            label={active ? 'Archive' : 'Reactivate'}
            buttonClassName={active ? 'button-danger' : 'button-quiet'}
            title={active ? `Archive ${group.name}?` : `Reactivate ${group.name}?`}
            description={active ? 'Students lose access to this group’s courses.' : 'Students regain access to this group’s courses.'}
            action={setGroupActive.bind(null, group.id, !active)}
            submitLabel={active ? 'Archive group' : 'Reactivate group'}
            submitClassName={active ? 'button-danger' : 'button'}
          />
        )}
        {can('tenant.groups.update') && (
          <ModalForm label="Edit group" title={`Edit ${group.name}`} action={updateGroup.bind(null, group.id)} submitLabel="Save">
            <div className="form-grid">
              <Field label="Name" name="name" defaultValue={group.name} />
              <Field label="Year level" name="yearLevel" defaultValue={group.yearLevel} />
              <Field label="Starts" name="startMonth" type="month" defaultValue={group.startMonth} />
              <Field label="Ends" name="endMonth" type="month" defaultValue={group.endMonth} />
            </div>
            <CoursePicker courses={options} selected={group.courses.map((c) => c.id)} />
          </ModalForm>
        )}
      </PageHead>
      {group.accessEndsAt && (
        <p className={`notice ${ended ? 'notice-error' : 'notice-warn'}`}>
          {ended
            ? `This group ended on ${shortDate(group.accessEndsAt, timezone)}. Its students no longer have its course materials or classes.`
            : `This group ends on ${shortDate(group.accessEndsAt, timezone)}. Students lose its course materials and classes from then.`}
        </p>
      )}
      <div className="cols cols-main">
        <Panel
          title={`Students (${group.memberCount})`}
          action={
            candidates ? (
              <ModalForm
                label="Add students"
                buttonClassName="button-quiet button-sm"
                title="Add students"
                description={`${group.name}: tick the students to add, then add them all at once.`}
                action={addGroupStudents.bind(null, group.id)}
                submitLabel="Add selected students"
              >
                <CheckList
                  name="studentId"
                  placeholder="Search by name"
                  empty="No more students to add."
                  items={addable.map((student) => ({
                    key: student.id,
                    text: `${student.firstName} ${student.lastName} ${student.email}`,
                    node: (
                      <Row
                        lead={<Avatar first={student.firstName} last={student.lastName} />}
                        title={`${student.firstName} ${student.lastName}`}
                        sub={student.email}
                      />
                    ),
                  }))}
                />
              </ModalForm>
            ) : undefined
          }
        >
          {group.membersHidden ? (
            <None>You have not been given access to the student list for this group.</None>
          ) : group.members.length === 0 ? (
            <None>Nobody in this group yet.</None>
          ) : (
            <div className="rows">
              {group.members.map((member) => (
                <Row
                  key={member.id}
                  lead={<Avatar first={member.firstName} last={member.lastName} />}
                  title={
                    <Link href={`/users/${member.id}`}>
                      {member.firstName} {member.lastName}
                    </Link>
                  }
                  sub={member.email}
                  end={
                    canManage && (
                      <ModalForm
                        label="Remove"
                        buttonClassName="button-danger button-sm"
                        title={`Remove ${member.firstName} from this group?`}
                        description="They lose access to this group’s courses."
                        action={removeGroupStudent.bind(null, group.id, member.id)}
                        submitLabel="Remove"
                        submitClassName="button-danger"
                      />
                    )
                  }
                />
              ))}
            </div>
          )}
        </Panel>
        <Panel
          title={`Teachers (${group.teachers.length})`}
          action={
            can('tenant.groups.update') && active ? (
              <ModalForm label="Add teacher" buttonClassName="button-quiet button-sm" title="Add a teacher" description={`${group.name}: choose what they can do in this group. Seeing the group, its courses, materials and classes is always included.`} action={addTeacherToGroup.bind(null, group.id)} submitLabel="Add teacher">
                {teachable.length === 0 ? (
                  <p className="muted">No staff with the Teacher role are free to add. Create a staff member with the Teacher role on the Staff page first.</p>
                ) : (
                  <Select label="Teacher" name="userId" options={teachable.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} />
                )}
                <Checks label="Allowed to" name="permissions" options={permissionOptions} selected={[]} />
              </ModalForm>
            ) : undefined
          }
        >
          {group.teachers.length === 0 ? (
            <None>No teachers added yet.</None>
          ) : (
            <div className="rows">
              {group.teachers.map((teacher) => (
                <Row
                  key={teacher.id}
                  lead={<Avatar first={teacher.firstName} last={teacher.lastName} />}
                  title={`${teacher.firstName} ${teacher.lastName}`}
                  sub={teacher.permissions.length === 0 ? 'View only' : teacher.permissions.map((p) => GROUP_PERMISSION_LABELS[p]).join(' · ')}
                  end={
                    can('tenant.groups.update') && (
                      <>
                        <ModalForm label="Rights" buttonClassName="button-quiet button-sm" title={`${teacher.firstName}'s rights in ${group.name}`} action={assignTeacher.bind(null, group.id, teacher.id)} submitLabel="Save">
                          <Checks label="Allowed to" name="permissions" options={permissionOptions} selected={teacher.permissions} />
                        </ModalForm>
                        <ModalForm label="Remove" buttonClassName="button-danger button-sm" title={`Remove ${teacher.firstName} from this group?`} description="They lose access to this group’s courses, classes and recordings straight away." action={removeTeacher.bind(null, group.id, teacher.id)} submitLabel="Remove" submitClassName="button-danger" />
                      </>
                    )
                  }
                />
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Courses">
          {group.courses.length === 0 ? (
            <None>No courses linked yet.</None>
          ) : (
            <div className="rows">
              {group.courses.map((course) => (
                <Row key={course.id} lead={<IconTile name="file" />} title={can('tenant.courses.read') || can('tenant.teaching.access') ? <Link href={`/courses/${course.id}`}>{course.name}</Link> : course.name} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
