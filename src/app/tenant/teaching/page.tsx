import { GROUP_PERMISSION_LABELS } from '@edura/contracts';
import Link from 'next/link';
import { getTeaching } from '@/lib/server';
import { IconTile, None, PageHead, Panel, Pill, Row } from '@/lib/ui';

export default async function TeachingPage() {
  const groups = await getTeaching();
  return (
    <>
      <PageHead title="My groups" sub="The student groups you teach, and what you can do in each." />
      {groups.length === 0 ? (
        <Panel>
          <None>You have not been added to a student group yet. Ask your academy admin.</None>
        </Panel>
      ) : (
        <div className="stack">
          {groups.map((group) => (
            <Panel key={group.id} title={group.name} action={<Link className="button-quiet button-sm" href={`/groups/${group.id}`}>Open group</Link>}>
              <p className="muted">{group.yearLevel}</p>
              <div className="pills">
                {group.permissions.length === 0 ? (
                  <Pill tone="off">View only</Pill>
                ) : (
                  group.permissions.map((permission) => (
                    <Pill key={permission} tone="good">
                      {GROUP_PERMISSION_LABELS[permission]}
                    </Pill>
                  ))
                )}
              </div>
              {group.courses.length === 0 ? (
                <None>No courses linked to this group yet.</None>
              ) : (
                <div className="rows">
                  {group.courses.map((course) => (
                    <Row key={course.id} lead={<IconTile name="file" />} title={<Link href={`/courses/${course.id}`}>{course.name}</Link>} />
                  ))}
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
