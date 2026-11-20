import type { CourseDto } from '@edura/contracts';
import Link from 'next/link';
import { ModalForm } from '@/lib/action-form';
import { glyphFor, posterClass } from '@/lib/poster';
import { callAsUser, getMe } from '@/lib/server';
import { Field, Forbidden, None, PageHead, Panel, Row, Tabs, TextArea } from '@/lib/ui';
import { createCourse } from '../academic-actions';

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [me, params] = await Promise.all([getMe(), searchParams]);
  const status = params.status === 'inactive' ? 'inactive' : 'active';
  const result = await callAsUser<{ items: CourseDto[] }>('academic', `/courses?status=${status}&limit=99`);
  if (result.status === 403) return <Forbidden what="courses" />;

  const courses = result.ok ? result.data.items : [];

  return (
    <>
      <PageHead title="Courses" sub={`${courses.length} ${status}`}>
        {me.permissions.includes('tenant.courses.create') && (
          <ModalForm label="Add course" title="Add course" action={createCourse} submitLabel="Add course">
            <div className="form-grid">
              <Field label="Name" name="name" />
              <Field label="Duration in years (optional)" name="durationYears" type="number" min={1} max={10} required={false} />
            </div>
            <TextArea label="Description (optional)" name="description" rows={3} maxLength={1000} required={false} />
          </ModalForm>
        )}
      </PageHead>
      <Tabs
        label="Status"
        items={[
          { href: '/courses?status=active', label: 'Active', current: status === 'active' },
          { href: '/courses?status=inactive', label: 'Inactive', current: status === 'inactive' },
        ]}
      />
      {courses.length === 0 ? (
        <Panel>
          <None>No courses here yet.</None>
        </Panel>
      ) : (
        <div className="poster-grid">
          {courses.map((course, index) => (
            <Link className={`poster ${posterClass(index)}`} href={`/courses/${course.id}`} key={course.id}>
              <span className="poster-glyph">{glyphFor(course.name)}</span>
              <span>
                <span className="poster-name">{course.name}</span>
                {course.endedAt && (
                  <span className="poster-sub">
                    <br />
                    {course.contentDeletedAt ? 'Ended · content deleted' : 'Ended'}
                  </span>
                )}
                {course.durationYears && (
                  <span className="poster-sub">
                    <br />
                    {course.durationYears} {course.durationYears === 1 ? 'year' : 'years'}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
