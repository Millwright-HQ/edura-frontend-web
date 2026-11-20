import type { ContentItemDto, ContinueWatchingDto, LearnerCourseDetailDto, LearnerSummaryDto } from '@edura/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { callAsUser } from '@/lib/server';
import { Empty, Pill } from '@/lib/ui';
import { CourseFilters } from './course-filters';
import { ItemViewer } from './item-viewer';

const KIND: Record<ContentItemDto['type'], { label: string; section: string; tone: 'good' | 'warn' }> = {
  recording: { label: 'Recording', section: 'Lecture recordings', tone: 'good' },
  video: { label: 'Video', section: 'Videos', tone: 'good' },
  notes: { label: 'Notes', section: 'Notes', tone: 'warn' },
  resource: { label: 'Resource', section: 'Resources', tone: 'warn' },
};
const SECTION_ORDER: ContentItemDto['type'][] = ['recording', 'video', 'notes', 'resource'];

type Week = LearnerCourseDetailDto['weeks'][number];

export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ week?: string; chapter?: string }>;
}) {
  const [{ courseId }, query] = await Promise.all([params, searchParams]);
  const [result, continuing, mine] = await Promise.all([
    callAsUser<LearnerCourseDetailDto>('academic', `/me/courses/${courseId}`),
    callAsUser<ContinueWatchingDto[]>('academic', '/me/continue-watching'),
    callAsUser<LearnerSummaryDto>('academic', '/me/courses'),
  ]);
  if (result.status === 403) {
    return (
      <Empty icon="shield" title="Your access to this course has ended" body="Your student group has finished, so the course material is no longer available. You can still sign in to see your results." heading="h1">
        <Link className="button" href="/my-courses">
          Back to my courses
        </Link>
      </Empty>
    );
  }
  if (!result.ok) notFound();
  const course = result.data;
  const courses = mine.ok ? mine.data.courses.map((c) => ({ id: c.id, name: c.name })) : [{ id: course.id, name: course.name }];
  const resume = continuing.ok ? continuing.data.find((video) => video.courseId === course.id) : undefined;

  const chapterFilter = course.chapters.some((chapter) => chapter.id === query.chapter) ? (query.chapter as string) : '';
  const chapterOf = (week: Week) => course.chapters.find((chapter) => chapter.id === week.chapterId);
  const visible = course.weeks.filter((week) => !chapterFilter || week.chapterId === chapterFilter);

  // The week being read: the one asked for, else the latest week with something in it, in the chapter being taught.
  const current = course.chapters.find((chapter) => !chapter.completed);
  const latest = [...visible].reverse().find((week) => week.items.length > 0) ?? visible.at(-1);
  const selected = course.weeks.find((week) => week.id === query.week) ?? latest;
  const chapter = selected ? chapterOf(selected) : undefined;

  const hrefFor = (week: Week) => `/learn/${course.id}?week=${week.id}${chapterFilter ? `&chapter=${chapterFilter}` : ''}`;
  const groups: { key: string; title: string; weeks: Week[] }[] = [
    ...course.chapters.map((c) => ({ key: c.id, title: `Chapter ${c.number}: ${c.title}`, weeks: visible.filter((week) => week.chapterId === c.id) })),
    {
      key: 'other',
      title: course.chapters.length > 0 ? 'Other weeks' : '',
      weeks: visible.filter((week) => !week.chapterId || !course.chapters.some((c) => c.id === week.chapterId)),
    },
  ].filter((group) => group.weeks.length > 0);

  return (
    <div className="learn-shell">
      <aside className="learn-side" aria-label="Course navigation">
        <div className="learn-filter-card">
          <h2>Filters</h2>
          <CourseFilters
            courseId={course.id}
            courses={courses}
            chapters={course.chapters.map((c) => ({ id: c.id, label: `Chapter ${c.number}: ${c.title}` }))}
            chapterId={chapterFilter}
          />
        </div>
        <div className="learn-weeks">
          <h2>Course weeks</h2>
          <p className="muted small">
            {visible.length} {visible.length === 1 ? 'week' : 'weeks'} available
          </p>
          {groups.map((group) => (
            <div key={group.key} className="learn-group">
              {group.title && <h3>{group.title}</h3>}
              {group.weeks.map((week) => (
                <Link key={week.id} href={hrefFor(week)} className={`learn-week${week.id === selected?.id ? ' is-current' : ''}`} aria-current={week.id === selected?.id ? 'page' : undefined}>
                  <strong>Week {week.number}</strong>
                  <span>{week.title}</span>
                </Link>
              ))}
            </div>
          ))}
          {groups.length === 0 && <p className="muted small">Nothing has been added to this course yet.</p>}
        </div>
      </aside>

      <section className="learn-main">
        <Link className="crumb" href="/my-courses">
          ‹ My courses
        </Link>
        {!selected ? (
          <Empty icon="file" title="Nothing here yet" body="Your academy hasn’t added anything to this course." />
        ) : (
          <>
            <header className="learn-head">
              <p className="learn-eyebrow">{chapter ? `Chapter ${chapter.number}: ${chapter.title}` : course.name}</p>
              <h1>
                Week {selected.number}: {selected.title}
              </h1>
              <p className="muted">
                {course.name}
                {chapter && <> · </>}
                {chapter && <Pill tone={chapter.completed ? 'good' : 'warn'}>{chapter.completed ? 'Chapter completed' : chapter.id === current?.id ? 'Being taught now' : 'In progress'}</Pill>}
              </p>
              {resume && (
                <Link className="button" href={`/learn/${resume.courseId}?week=${resume.weekId}#item-${resume.itemId}`}>
                  Resume Week {resume.weekNumber}
                </Link>
              )}
            </header>
            {selected.items.length === 0 ? (
              <p className="learn-empty">Nothing has been added to this week yet.</p>
            ) : (
              SECTION_ORDER.map((type) => {
                const items = selected.items.filter((item) => item.type === type);
                if (items.length === 0) return null;
                return (
                  <section key={type} className="learn-section">
                    <h2>{KIND[type].section}</h2>
                    <div className="learn-items">
                      {items.map((item) => (
                        <ItemViewer
                          key={item.id}
                          courseId={course.id}
                          weekId={selected.id}
                          item={item}
                          startAt={continuing.ok ? (continuing.data.find((v) => v.itemId === item.id)?.positionSeconds ?? 0) : 0}
                          label={KIND[type].label}
                          tone={KIND[type].tone}
                        />
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </>
        )}
      </section>
    </div>
  );
}
