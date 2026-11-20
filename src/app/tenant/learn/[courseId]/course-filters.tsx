'use client';

import { useRouter } from 'next/navigation';

/** The sidebar's two drop-downs. Choosing one goes straight to that course or chapter, with no Apply button. */
export function CourseFilters({
  courseId,
  courses,
  chapters,
  chapterId,
}: {
  courseId: string;
  courses: { id: string; name: string }[];
  chapters: { id: string; label: string }[];
  chapterId: string;
}) {
  const router = useRouter();
  return (
    <div className="learn-filters">
      <label>
        <span>Course</span>
        <select value={courseId} onChange={(event) => router.push(`/learn/${event.target.value}`)}>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </select>
      </label>
      {chapters.length > 0 && (
        <label>
          <span>Chapter</span>
          <select
            value={chapterId}
            onChange={(event) => router.push(event.target.value ? `/learn/${courseId}?chapter=${event.target.value}` : `/learn/${courseId}`)}
          >
            <option value="">All chapters</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
