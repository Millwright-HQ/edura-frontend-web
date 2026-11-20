import type { ChapterDto, ContentItemDto, CourseDetailDto, WeekDto } from '@edura/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionButton, ModalForm } from '@/lib/action-form';
import { callAsUser, getMe, getTeaching, teacherCan } from '@/lib/server';
import { Checks, Field, Forbidden, IconTile, None, PageHead, Panel, Pill, Row, Select, Stat, TextArea } from '@/lib/ui';
import {
  addChapter,
  addWeek,
  deleteChapter,
  deleteCourseContent,
  deleteItem,
  deleteWeek,
  endCourse,
  renameChapter,
  setChapterDone,
  setCourseActive,
  setItemDownload,
  setItemHidden,
  setWeekHidden,
  updateCourse,
  updateWeek,
} from '../../academic-actions';
import { UploadForm } from './upload-form';

const TYPE_LABEL: Record<ContentItemDto['type'], string> = {
  recording: 'Lecture recording',
  video: 'Video',
  notes: 'Class notes',
  resource: 'Resource',
};

function size(bytes: number) {
  if (!bytes) return 'On Zoom';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

interface Rights {
  upload: boolean;
  manage: boolean;
  remove: boolean;
}

function WeekFields({ week, chapters, nextNumber, chapterId }: { week?: WeekDto; chapters: ChapterDto[]; nextNumber: number; chapterId?: string | undefined }) {
  return (
    <>
      <div className="form-grid">
        <Field label="Week number" name="number" type="number" min={1} max={500} defaultValue={week?.number ?? nextNumber} />
        <Field label="Topic" name="title" defaultValue={week?.title} hint="What is taught this week." />
      </div>
      <Select
        label="Chapter"
        name="chapterId"
        required={false}
        defaultValue={week?.chapterId ?? chapterId ?? ''}
        options={[{ value: '', label: 'Not in a chapter' }, ...chapters.map((chapter) => ({ value: chapter.id, label: `Chapter ${chapter.number}: ${chapter.title}` }))]}
      />
    </>
  );
}

/** One week, opened in place: its files, and everything you can do to them. */
function WeekSection({
  courseId,
  week,
  items,
  chapters,
  rights,
  open,
}: {
  courseId: string;
  week: WeekDto;
  items: ContentItemDto[];
  chapters: ChapterDto[];
  rights: Rights;
  open: boolean;
}) {
  const ready = items.filter((item) => item.status === 'READY');
  return (
    <details id={`week-${week.id}`} open={open}>
      <summary>
        <span>
          Week {week.number} <span className="muted">· {week.title}</span>
          {week.hidden && (
            <>
              {' '}
              <Pill tone="off">Hidden from students</Pill>
            </>
          )}
        </span>
        <small>
          {week.itemCount} {week.itemCount === 1 ? 'file' : 'files'}
        </small>
      </summary>
      <div className="accordion-body">
        <div className="chapter-tools">
          {rights.upload && <UploadForm courseId={courseId} weekId={week.id} />}
          {rights.upload && (
            <ModalForm label="Edit week" buttonClassName="button-quiet" title={`Edit Week ${week.number}`} action={updateWeek.bind(null, courseId, week.id)} submitLabel="Save">
              <WeekFields week={week} chapters={chapters} nextNumber={week.number} />
            </ModalForm>
          )}
          {rights.upload && (
            <ActionButton
              action={setWeekHidden.bind(null, courseId, week.id, !week.hidden)}
              label={week.hidden ? 'Show to students' : 'Hide from students'}
            />
          )}
          {rights.remove && (
            <ModalForm
              label="Delete week"
              buttonClassName="button-danger button-sm"
              title={`Delete Week ${week.number}?`}
              description="This can’t be undone. Remove its files first."
              action={deleteWeek.bind(null, courseId, week.id)}
              submitLabel="Delete week"
              submitClassName="button-danger"
              confirmWord="DELETE"
            />
          )}
        </div>
        {ready.length === 0 ? (
          <p className="accordion-row muted">Nothing uploaded yet.</p>
        ) : (
          <div className="rows">
            {ready.map((item, index) => (
              <Row
                key={item.id}
                lead={<IconTile name={item.mimeType.startsWith('video/') || item.type === 'recording' ? 'video' : 'file'} alt={index % 2 === 1} />}
                title={<Link href={`/view/${courseId}/${week.id}/${item.id}`}>{item.title}</Link>}
                sub={`${TYPE_LABEL[item.type]} · ${size(item.size)} · ${item.hidden ? 'Hidden from students' : item.allowDownload ? 'Students can download' : 'View only for students'}`}
                end={
                  <>
                    {rights.manage && <ActionButton action={setItemHidden.bind(null, courseId, week.id, item.id, !item.hidden)} label={item.hidden ? 'Show' : 'Hide'} />}
                    {rights.manage && <ActionButton action={setItemDownload.bind(null, courseId, week.id, item.id, !item.allowDownload)} label={item.allowDownload ? 'Block downloads' : 'Allow downloads'} />}
                    {rights.remove && (
                      <ModalForm
                        label="Delete"
                        buttonClassName="button-danger button-sm"
                        title={`Delete ${item.title}?`}
                        description="Students will lose access straight away."
                        action={deleteItem.bind(null, courseId, week.id, item.id)}
                        submitLabel="Delete"
                        submitClassName="button-danger"
                      />
                    )}
                  </>
                }
              />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

export default async function CoursePage({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<{ open?: string }> }) {
  const [{ courseId }, query] = await Promise.all([params, searchParams]);
  const [me, result, teaching] = await Promise.all([getMe(), callAsUser<CourseDetailDto>('academic', `/courses/${courseId}`), getTeaching()]);
  if (result.status === 403) return <Forbidden what="courses" />;
  if (!result.ok) notFound();

  const course = result.data;
  const active = course.status === 'ACTIVE';
  const can = (permission: string) => me.permissions.includes(permission);
  const rights: Rights = {
    upload: can('tenant.content.upload') || teacherCan(teaching, courseId, 'materials.upload'),
    manage: can('tenant.content.update') || teacherCan(teaching, courseId, 'materials.manage'),
    remove: can('tenant.content.delete') || teacherCan(teaching, courseId, 'materials.manage'),
  };
  const mayStructure = can('tenant.content.update') || teacherCan(teaching, courseId, 'materials.upload');

  // Every week's files at once, so a week opens without another trip to the server.
  const itemLists = await Promise.all(course.weeks.map((week) => callAsUser<ContentItemDto[]>('academic', `/courses/${courseId}/weeks/${week.id}/items`)));
  const itemsOf = new Map(course.weeks.map((week, index) => [week.id, itemLists[index]!.ok ? itemLists[index]!.data : []]));

  const nextWeek = Math.max(0, ...course.weeks.map((week) => week.number)) + 1;
  const totalItems = course.weeks.reduce((sum, week) => sum + week.itemCount, 0);
  const done = course.chapters.filter((chapter) => chapter.status === 'COMPLETED').length;
  const weeksIn = (chapterId: string | undefined) => course.weeks.filter((week) => week.chapterId === chapterId);
  const loose = course.weeks.filter((week) => !week.chapterId || !course.chapters.some((chapter) => chapter.id === week.chapterId));

  // The week named in the address is opened, along with the chapter that holds it. Otherwise the chapter being taught.
  const target = course.weeks.find((week) => week.id === query.open);
  const firstOpenChapter = course.chapters.find((chapter) => chapter.status === 'IN_PROGRESS')?.id;
  const chapterOpen = (chapter: ChapterDto) => (target ? target.chapterId === chapter.id : chapter.id === firstOpenChapter);

  return (
    <>
      <PageHead title={course.name} sub={course.description} back={{ href: '/courses', label: 'Courses' }}>
        {can('tenant.courses.deactivate') && !course.endedAt && (
          <ModalForm
            label="End course"
            buttonClassName="button-danger"
            title={`End ${course.name}?`}
            description="The course is switched off for students and parents. You can then delete its weeks and files while keeping the course and its chapter names for old results and invoices."
            action={endCourse.bind(null, course.id)}
            submitLabel="End course"
            submitClassName="button-danger"
          />
        )}
        {can('tenant.courses.deactivate') && course.endedAt && !course.contentDeletedAt && (
          <ModalForm
            label="Delete content"
            buttonClassName="button-danger"
            title={`Delete all content of ${course.name}?`}
            description="Every week and every file is deleted for good, including the stored files. The course and its chapter names stay. This cannot be undone."
            action={deleteCourseContent.bind(null, course.id)}
            submitLabel="Delete all content"
            submitClassName="button-danger"
            confirmWord="DELETE"
          />
        )}
        {can('tenant.courses.deactivate') && !course.contentDeletedAt && (
          <ModalForm
            label={active ? 'Deactivate' : 'Reactivate'}
            buttonClassName={active ? 'button-danger' : 'button-quiet'}
            title={active ? `Deactivate ${course.name}?` : `Reactivate ${course.name}?`}
            description={active ? 'Students will no longer see this course.' : 'Students in linked groups will see it again.'}
            action={setCourseActive.bind(null, course.id, !active)}
            submitLabel={active ? 'Deactivate course' : 'Reactivate course'}
            submitClassName={active ? 'button-danger' : 'button'}
          />
        )}
        {can('tenant.courses.update') && (
          <ModalForm label="Edit course" buttonClassName="button-quiet" title={`Edit ${course.name}`} action={updateCourse.bind(null, course.id)} submitLabel="Save">
            <div className="form-grid">
              <Field label="Name" name="name" defaultValue={course.name} />
              <Field label="Duration in years (optional)" name="durationYears" type="number" min={1} max={10} defaultValue={course.durationYears} required={false} />
            </div>
            <TextArea label="Description (optional)" name="description" rows={3} maxLength={1000} defaultValue={course.description} required={false} />
          </ModalForm>
        )}
        {mayStructure && (
          <ModalForm label="Add chapter" buttonClassName="button-quiet" title="Add a chapter" description={`Chapters group the weeks of ${course.name}. Parents see which are completed.`} action={addChapter.bind(null, course.id)} submitLabel="Add chapter">
            <Field label="Chapter title" name="title" />
          </ModalForm>
        )}
        {mayStructure && (
          <ModalForm label="Add week" title="Add a week" description={course.name} action={addWeek.bind(null, course.id)} submitLabel="Add week">
            <WeekFields chapters={course.chapters} nextNumber={nextWeek} />
          </ModalForm>
        )}
      </PageHead>
      {course.contentDeletedAt ? (
        <p className="notice notice-warn">This course has ended and its content was deleted. Only its name and chapters remain, for old results and invoices.</p>
      ) : course.endedAt ? (
        <p className="notice notice-warn">This course has ended, so students can&apos;t see it. You can now delete its content.</p>
      ) : (
        !active && <p className="notice notice-warn">This course is inactive, so students can&apos;t see it.</p>
      )}
      <div className="stats">
        <Stat value={`${done} of ${course.chapters.length}`} label="Chapters completed" tone="primary" />
        <Stat value={course.weeks.length} label="Weeks" tone="soft" />
        <Stat value={totalItems} label="Files" tone="tint" />
      </div>

      {course.chapters.length === 0 && course.weeks.length === 0 ? (
        <Panel>
          <None>Nothing here yet. Add a chapter, then the weeks inside it.</None>
        </Panel>
      ) : (
        <div className="accordion">
          {course.chapters.map((chapter, index) => {
            const weeks = weeksIn(chapter.id);
            const finished = chapter.status === 'COMPLETED';
            const doneGroups = chapter.groups.filter((group) => group.completed);
            const pendingGroups = chapter.groups.filter((group) => !group.completed);
            const asOptions = (list: ChapterDto['groups']) => list.map((group) => ({ value: group.id, label: group.name }));
            return (
              <details key={chapter.id} id={`chapter-${chapter.id}`} open={chapterOpen(chapter)}>
                <summary>
                  <span>
                    Chapter {chapter.number}: {chapter.title}
                  </span>
                  <span className="summary-end">
                    <Pill tone={finished ? 'good' : doneGroups.length > 0 ? 'solid' : 'warn'}>
                      {finished ? 'Completed' : doneGroups.length > 0 ? `Completed for ${doneGroups.length} of ${chapter.groups.length} groups` : 'In progress'}
                    </Pill>
                    <small>
                      {weeks.length} {weeks.length === 1 ? 'week' : 'weeks'}
                    </small>
                  </span>
                </summary>
                <div className="accordion-body">
                  {mayStructure && (
                    <div className="chapter-tools">
                      {chapter.groups.length === 0 ? (
                        <span className="muted small">Add this course to a student group to mark chapters completed.</span>
                      ) : (
                        <>
                          {pendingGroups.length > 0 && (
                            <ModalForm
                              label="Mark chapter completed"
                              buttonClassName="button button-sm"
                              title={`Mark “${chapter.title}” as completed?`}
                              description="Choose the groups that have finished it. Their students and parents will see it as completed. Other groups are not affected."
                              action={setChapterDone.bind(null, course.id, chapter.id, true)}
                              submitLabel="Mark completed"
                            >
                              <Checks label="Groups" name="groupIds" options={asOptions(pendingGroups)} selected={pendingGroups.map((group) => group.id)} />
                            </ModalForm>
                          )}
                          {doneGroups.length > 0 && (
                            <ModalForm
                              label="Reopen chapter"
                              buttonClassName="button-quiet button-sm"
                              title={`Reopen “${chapter.title}”?`}
                              description="Choose the groups to reopen it for. They will see it as in progress again."
                              action={setChapterDone.bind(null, course.id, chapter.id, false)}
                              submitLabel="Reopen"
                            >
                              <Checks label="Groups" name="groupIds" options={asOptions(doneGroups)} />
                            </ModalForm>
                          )}
                        </>
                      )}
                      <ModalForm label="Rename" buttonClassName="button-quiet button-sm" title="Rename chapter" action={renameChapter.bind(null, course.id, chapter.id)} submitLabel="Save">
                        <Field label="Chapter title" name="title" defaultValue={chapter.title} />
                      </ModalForm>
                      {rights.remove && (
                        <ModalForm
                          label="Delete chapter"
                          buttonClassName="button-danger button-sm"
                          title={`Delete “${chapter.title}”?`}
                          description={weeks.length > 0 ? 'Move its weeks to another chapter first.' : 'This chapter has no weeks, so nothing else is lost.'}
                          action={deleteChapter.bind(null, course.id, chapter.id)}
                          submitLabel="Delete chapter"
                          submitClassName="button-danger"
                        />
                      )}
                    </div>
                  )}
                  {chapter.groups.length > 0 && (
                    <div className="chapter-chips">
                      {chapter.groups.map((group) => (
                        <Pill key={group.id} tone={group.completed ? 'good' : 'off'}>
                          {group.completed ? '✓ ' : ''}
                          {group.name}
                          {group.completedAt ? ` · ${new Date(group.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                        </Pill>
                      ))}
                    </div>
                  )}
                  {weeks.length === 0 ? (
                    <p className="accordion-row muted">No weeks in this chapter yet.</p>
                  ) : (
                    <div className="accordion nested">
                      {weeks.map((week) => (
                        <WeekSection key={week.id} courseId={course.id} week={week} items={itemsOf.get(week.id) ?? []} chapters={course.chapters} rights={rights} open={week.id === target?.id} />
                      ))}
                    </div>
                  )}
                </div>
              </details>
            );
          })}
          {loose.length > 0 && (
            <details open={Boolean(target && loose.some((week) => week.id === target.id)) || course.chapters.length === 0}>
              <summary>
                <span>{course.chapters.length === 0 ? 'Weeks' : 'Weeks not in a chapter'}</span>
                <small>
                  {loose.length} {loose.length === 1 ? 'week' : 'weeks'}
                </small>
              </summary>
              <div className="accordion-body">
                <div className="accordion nested">
                  {loose.map((week) => (
                    <WeekSection key={week.id} courseId={course.id} week={week} items={itemsOf.get(week.id) ?? []} chapters={course.chapters} rights={rights} open={week.id === target?.id} />
                  ))}
                </div>
              </div>
            </details>
          )}
        </div>
      )}
    </>
  );
}
