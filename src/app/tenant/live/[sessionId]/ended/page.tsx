import type { LearnerScheduleDto, SessionDto } from '@edura/contracts';
import Link from 'next/link';
import { callAsUser, getMe } from '@/lib/server';
import { ClassButtons } from '../../../class-buttons';
import { CloseClassWindow } from '../../../class-window';

/**
 * Where a person lands when they leave or the host ends the class. Someone who left a long class that is
 * made of several meetings is offered the next one; everyone is told what happens to the recording and materials.
 */
export default async function ClassEndedPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ part?: string }>;
}) {
  const [{ sessionId }, { part }, me] = await Promise.all([params, searchParams, getMe()]);
  const isStudent = me.kind === 'student';
  const partNumber = part && /^\d{1,2}$/.test(part) ? Number(part) : 1;

  let topic = 'Your class';
  let partCount = 1;
  let week: { courseId: string; weekId: string } | undefined;
  if (isStudent) {
    const mine = await callAsUser<LearnerScheduleDto>('classes', '/me/schedule');
    const session = mine.ok ? [...mine.data.upcoming, ...mine.data.past].find((item) => item.id === sessionId) : undefined;
    if (session) {
      topic = session.topic;
      partCount = session.parts?.length ?? 1;
    }
  } else {
    const detail = await callAsUser<SessionDto>('classes', `/sessions/${sessionId}`);
    if (detail.ok) {
      topic = detail.data.topic;
      partCount = detail.data.parts.length;
      week = detail.data.week;
    }
  }
  const hasNext = partCount > 1 && partNumber < partCount;
  const next = partNumber + 1;

  return (
    <div className="stack narrow">
      <header className="page-head">
        <h1>Class ended</h1>
        <p className="muted">
          {topic}
          {partCount > 1 ? ` · part ${partNumber} of ${partCount}` : ''}
        </p>
      </header>

      {hasNext && (
        <section className="notice" aria-label="Next part">
          <p>
            <strong>This class continues in part {next}.</strong> Zoom ends each meeting after a set time on a free plan, so the class carries on in a new meeting.
          </p>
          <p>
            <ClassButtons kind={isStudent ? 'join' : 'host'} sessionId={sessionId} part={next} parts={partCount} />
          </p>
        </section>
      )}

      <section className="notice" aria-label="What happens next">
        <p>
          <strong>What happens next</strong>
        </p>
        <ul>
          <li>
            If your Zoom account is on a paid plan, the recording is added to {week ? 'the course week this class belongs to' : 'your recordings'} once Zoom has
            processed it. That is usually within an hour of the class ending, longer for a long class.
          </li>
          <li>The course materials for this class are available now{isStudent ? ' under My courses' : ''}.</li>
          {!isStudent && <li>Attendance is filled in from Zoom when the last meeting of the class ends.</li>}
        </ul>
      </section>

      <p className="td-actions">
        <CloseClassWindow />
        {isStudent ? (
          <>
            <Link className="button" href="/schedule">
              Back to my schedule
            </Link>
            <Link className="button-soft" href="/my-courses">
              My courses
            </Link>
          </>
        ) : (
          <>
            <Link className="button" href="/schedule">
              Back to the class schedule
            </Link>
            {week && (
              <Link className="button-soft" href={`/courses/${week.courseId}?open=${week.weekId}`}>
                Open the course week
              </Link>
            )}
          </>
        )}
      </p>
    </div>
  );
}
