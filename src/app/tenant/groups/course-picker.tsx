import type { CourseDto } from '@edura/contracts';
import { Checks } from '@/lib/ui';

export function CoursePicker({ courses, selected }: { courses: Pick<CourseDto, 'id' | 'name'>[]; selected: string[] }) {
  if (courses.length === 0) return <p className="muted">Add a course first, then link it here.</p>;
  return <Checks label="Courses" name="courseIds" options={courses.map((c) => ({ value: c.id, label: c.name }))} selected={selected} />;
}
