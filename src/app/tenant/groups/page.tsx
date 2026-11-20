import type { CourseDto, GroupDto } from '@edura/contracts';
import Link from 'next/link';
import { ModalForm } from '@/lib/action-form';
import { monthRange } from '@/lib/format';
import { callAsUser, getMe } from '@/lib/server';
import { Field, Forbidden, None, PageHead, Panel, Tabs } from '@/lib/ui';
import { createGroup } from '../academic-actions';
import { CoursePicker } from './course-picker';

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [me, params] = await Promise.all([getMe(), searchParams]);
  const status = params.status === 'inactive' ? 'inactive' : 'active';
  const [result, courses] = await Promise.all([
    callAsUser<{ items: GroupDto[] }>('academic', `/groups?status=${status}&limit=100`),
    callAsUser<{ items: CourseDto[] }>('academic', '/courses?limit=100'),
  ]);
  if (result.status === 403) return <Forbidden what="student groups" />;
  const groups = result.ok ? result.data.items : [];

  return (
    <>
      <PageHead title="Student groups">
        {me.permissions.includes('tenant.groups.create') && (
          <ModalForm label="Add group" title="Add group" action={createGroup} submitLabel="Add group">
            <div className="form-grid">
              <Field label="Name" name="name" />
              <Field label="Year level" name="yearLevel" />
              <Field label="Starts" name="startMonth" type="month" />
              <Field label="Ends" name="endMonth" type="month" />
            </div>
            <CoursePicker courses={courses.ok ? courses.data.items : []} selected={[]} />
          </ModalForm>
        )}
      </PageHead>
      <Tabs
        label="Status"
        items={[
          { href: '/groups?status=active', label: 'Active', current: status === 'active' },
          { href: '/groups?status=inactive', label: 'Archived', current: status === 'inactive' },
        ]}
      />
      {groups.length === 0 ? (
        <Panel>
          <None>No groups here yet.</None>
        </Panel>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Group</th>
                <th scope="col">Year level</th>
                <th scope="col">Runs</th>
                <th scope="col">Students</th>
                <th scope="col">
                  <span className="visually-hidden">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id}>
                  <td>
                    <Link href={`/groups/${group.id}`}>{group.name}</Link>
                  </td>
                  <td>{group.yearLevel}</td>
                  <td className="nowrap">
                    {monthRange(group.startMonth, group.endMonth)}
                  </td>
                  <td>{group.memberCount}</td>
                  <td>
                    <div className="td-actions">
                      <Link className="button-quiet button-sm" href={`/groups/${group.id}`}>
                        Open
                      </Link>
                    </div>
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
