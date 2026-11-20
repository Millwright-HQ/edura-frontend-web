import type { LearnerSummaryDto } from '@edura/contracts';
import Link from 'next/link';
import { glyphFor, posterClass } from '@/lib/poster';
import { callAsUser } from '@/lib/server';
import { getTimezone } from '@/lib/site';
import { shortDate } from '@/lib/format';
import { Empty, IconTile, PageHead, Panel, Row } from '@/lib/ui';

export default async function MyCoursesPage() {
  const result = await callAsUser<LearnerSummaryDto>('academic', '/me/courses');
  if (!result.ok) return <Empty icon="file" title="Courses are for students" heading="h1" />;
  const timezone = await getTimezone();
  return (
    <>
      <PageHead title="My courses" sub="Everything you’re enrolled in." />
      {result.data.courses.length === 0 ? (
        <Empty icon="file" title="No courses yet" body="You’ll see your courses here once you’re added to a group." />
      ) : (
        <div className="poster-grid">
          {result.data.courses.map((course, index) => (
            <Link className={`poster ${posterClass(index)}`} href={`/learn/${course.id}`} key={course.id}>
              <span className="poster-glyph">{glyphFor(course.name)}</span>
              <span className="poster-name">{course.name}</span>
              {course.progress && (
                <span className="poster-sub">
                  {course.progress.chaptersDone} of {course.progress.chaptersTotal} chapters completed
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
      {(result.data.endedCourses?.length ?? 0) > 0 && (
        <Panel title="Ended">
          <p className="muted small">Your group has finished, so the course material is no longer available. You can still see your results.</p>
          <div className="rows">
            {result.data.endedCourses!.map((course) => (
              <Row
                key={course.id}
                lead={<IconTile name="file" />}
                title={course.name}
                sub={course.endedAt ? `Access ended on ${shortDate(course.endedAt, timezone)}` : 'Access ended'}
              />
            ))}
          </div>
        </Panel>
      )}
      {result.data.groups.length > 0 && (
        <Panel title="My groups">
          <div className="rows">
            {result.data.groups.map((group) => (
              <Row key={group.id} lead={<IconTile name="users" />} title={group.name} sub={group.yearLevel} />
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}
