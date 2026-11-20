import { ClassButtons } from '../class-buttons';
import type {
  AttendanceSheetDto,
  StudentAttendanceDto,
  GroupDto,
  LearnerScheduleDto,
  LearnerSessionDto,
  PersonDto,
  CourseDetailDto,
  CourseDto,
  SessionDto,
  ZoomAccountDto,
  ZoomConnectionDto,
} from '@edura/contracts';
import { FREE_MEETING_MINUTES } from '@edura/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ModalForm } from '@/lib/action-form';
import { dateTime, dayParts, monthIn, monthTitle, timeOf, todayIn, utcToZonedInput } from '@/lib/format';
import { callAsUser, getMe, getTeaching } from '@/lib/server';
import { getTimezone } from '@/lib/site';
import { ATTENDANCE_STATUSES } from '@edura/contracts';
import { Checks, Empty, Field, Forbidden, FormSection, None, PageHead, Panel, Pill, Row, Select, Tabs, Toggle } from '@/lib/ui';
import { createSession, deleteSession, markAttendance, updateSession } from '../v1-actions';
import { MarkAllPresent } from './mark-all-present';

function shiftMonth(month: string, change: number) {
  const [year, value] = month.split('-').map(Number);
  return new Date(Date.UTC(year!, value! - 1 + change, 1)).toISOString().slice(0, 7);
}

function DateTile({ iso, tz }: { iso: string; tz: string }) {
  const { day, num } = dayParts(iso, tz);
  return (
    <span className="date-tile">
      {day}
      <b>{num}</b>
    </span>
  );
}

function SessionRows({ sessions, tz, showJoin, empty }: { sessions: LearnerSessionDto[]; tz: string; showJoin: boolean; empty: string }) {
  if (sessions.length === 0) return <None>{empty}</None>;
  return (
    <div className="rows">
      {sessions.map((session) => (
        <Row
          key={session.id}
          lead={<DateTile iso={session.startsAt} tz={tz} />}
          title={session.topic}
          sub={`${timeOf(session.startsAt, tz)} · ${session.durationMinutes} minutes${session.parts && session.parts.length > 1 ? ` · ${session.parts.length} parts, ${session.parts.map((part) => timeOf(part.startsAt, tz)).join(', ')}` : ''}`}
          end={
            showJoin ? (
              <span className="class-buttons">
                {session.canJoin &&
                  (session.parts && session.parts.length > 1 ? (
                    // A long class on a free Zoom account is several meetings in a row: one button for each.
                    <div className="td-actions">
                      {session.parts.map((part) => (
                        <ClassButtons key={part.part} kind="join" sessionId={session.id} part={part.part} parts={session.parts?.length} small />
                      ))}
                    </div>
                  ) : (
                    <ClassButtons kind="join" sessionId={session.id} />
                  ))}
                <a className="button-soft button-sm" href={`/calendar/${session.id}`}>
                  Add to calendar
                </a>
              </span>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}

/** A class that never ran is offered again two days on, at the same time of day. */
function suggestedStart(session: SessionDto, tz: string): string {
  const time = utcToZonedInput(session.startsAt, tz).slice(11);
  const day = utcToZonedInput(new Date(Date.now() + 2 * 24 * 3600_000).toISOString(), tz).slice(0, 10);
  return `${day}T${time}`;
}

const accountNote = (account: ZoomAccountDto) =>
  account.plan === 'free' ? `${account.displayName} (free plan, ${FREE_MEETING_MINUTES} min per link)` : `${account.displayName} (pro plan)`;

interface WeekOption {
  value: string;
  label: string;
}

function SessionFields({ groups, tz, session, zoomAccounts = [], weeks = [] }: { groups: GroupDto[]; tz: string; session?: SessionDto; zoomAccounts?: ZoomAccountDto[]; weeks?: WeekOption[] }) {
  // Which plan hosts it decides whether a long class needs several links.
  const free = session ? false : zoomAccounts.length > 0 && zoomAccounts.every((account) => account.plan === 'free');
  const mixed = !session && zoomAccounts.length > 1 && zoomAccounts.some((account) => account.plan === 'free');
  return (
    <>
      <Field label="Topic" name="topic" defaultValue={session?.topic} />
      {!session && zoomAccounts.length > 1 && (
        <Select label="Zoom account that hosts it" name="zoomAccountId" options={zoomAccounts.map((a) => ({ value: a.accountId, label: accountNote(a) }))} />
      )}
      <div className="form-grid">
        <Field label={`Starts (${tz})`} name="startsAt" type="datetime-local" defaultValue={session ? utcToZonedInput(session.startsAt, tz) : undefined} />
        <Field
          label="Length in minutes"
          name="durationMinutes"
          type="number"
          min={15}
          max={480}
          defaultValue={session?.durationMinutes ?? 60}
          hint={
            free
              ? `Your Zoom account is on the free plan, which ends a meeting after ${FREE_MEETING_MINUTES} minutes. A longer class gets one link for each ${FREE_MEETING_MINUTES} minutes (two hours is three links) and students are given all of them.`
              : mixed
                ? `Free Zoom accounts end a meeting after ${FREE_MEETING_MINUTES} minutes, so a longer class on one of those gets several links.`
                : undefined
          }
        />
      </div>
      <Checks label="Groups" name="groupIds" options={groups.map((g) => ({ value: g.id, label: g.name }))} selected={session?.groups.map((g) => g.id) ?? []} />
      {weeks.length > 0 && (
        <Select
          label="Course week it teaches"
          name="week"
          required={false}
          defaultValue={session?.week ? `${session.week.courseId}/${session.week.weekId}` : ''}
          options={[{ value: '', label: 'Not tied to a week' }, ...weeks]}
        />
      )}
      <Toggle
        label={session ? 'Email families if the time changes' : 'Email the class and its Zoom links'}
        name="sendEmail"
        hint="Students and their parents each get one email with every link."
        defaultChecked
      />
      {weeks.length > 0 && <p className="muted small">When the class is tied to a week, its Zoom recording is added to that week by itself once Zoom has processed it.</p>}
    </>
  );
}

function EditClass({ session, groups, tz, label, buttonClassName, weeks = [] }: { session: SessionDto; groups: GroupDto[]; tz: string; label: ReactNode; buttonClassName: string; weeks?: WeekOption[] }) {
  if (session.status === 'missed') return <RescheduleClass session={session} tz={tz} label={label} buttonClassName={buttonClassName} />;
  const split = session.parts.length > 1;
  return (
    <ModalForm label={label} buttonClassName={buttonClassName} title="Edit class" description={`${dateTime(session.startsAt, tz)}${split ? ` · ${session.parts.length} Zoom links` : ''}`} action={updateSession.bind(null, session.id)} submitLabel="Save">
      <SessionFields groups={groups} tz={tz} session={session} weeks={weeks} />
      {split && <p className="muted small">Changing the time or length makes new Zoom links, and students and parents are told.</p>}
    </ModalForm>
  );
}

/** For a class whose time passed without anyone starting it. Only the new time is asked for. */
function RescheduleClass({ session, tz, label, buttonClassName }: { session: SessionDto; tz: string; label: ReactNode; buttonClassName: string }) {
  return (
    <ModalForm
      label={label}
      buttonClassName={buttonClassName}
      title="Reschedule this class"
      description={`${session.topic} was set for ${dateTime(session.startsAt, tz)} and did not take place. Students cannot join it now. Choose a new time and students and parents are told.`}
      action={updateSession.bind(null, session.id)}
      submitLabel="Reschedule"
    >
      <input type="hidden" name="topic" value={session.topic} />
      <input type="hidden" name="sendEmail" value="on" />
      {session.groups.map((group) => (
        <input key={group.id} type="hidden" name="groupIds" value={group.id} />
      ))}
      <div className="form-grid">
        <Field label={`New start (${tz})`} name="startsAt" type="datetime-local" defaultValue={suggestedStart(session, tz)} hint="Suggested: two days from now, same time." />
        <Field label="Length in minutes" name="durationMinutes" type="number" min={15} max={480} defaultValue={session.durationMinutes} />
      </div>
    </ModalForm>
  );
}

function Calendar({ month, tz, sessions, today, canEdit, groups, weeks }: { month: string; tz: string; sessions: SessionDto[]; today: string; canEdit: boolean; groups: GroupDto[]; weeks: WeekOption[] }) {
  const [year, value] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year!, value! - 1, 1));
  const blanks = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year!, value!, 0)).getUTCDate();
  const byDay = new Map<number, SessionDto[]>();
  for (const session of sessions) {
    const day = Number(utcToZonedInput(session.startsAt, tz).slice(8, 10));
    byDay.set(day, [...(byDay.get(day) ?? []), session]);
  }
  return (
    <div className="calendar-wrap">
      <div className="calendar">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <span className="calendar-dow" key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: blanks }, (_, i) => (
          <div className="calendar-day is-blank" key={`b${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const isToday = `${month}-${String(day).padStart(2, '0')}` === today;
          return (
            <div className={`calendar-day${isToday ? ' is-today' : ''}`} key={day}>
              {day}
              {(byDay.get(day) ?? []).map((session) => {
                const text = `${timeOf(session.startsAt, tz)} ${session.topic}`;
                return canEdit && session.status !== 'held' ? (
                  <EditClass key={session.id} session={session} groups={groups} tz={tz} label={text} buttonClassName="calendar-event" weeks={weeks} />
                ) : (
                  <span className="calendar-event" key={session.id}>
                    {text}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_LABEL = { present: 'Present', late: 'Late', absent: 'Absent', excused: 'Excused' } as const;

/**
 * Marking sheet for one class. Blank means not marked yet. When Zoom has reported who was in the class, its
 * marks are already filled in, with the minutes each student was there; anything can still be changed.
 */
function AttendanceModal({ sheet }: { sheet: AttendanceSheetDto }) {
  const fromZoom = sheet.rows.filter((row) => row.source === 'zoom').length;
  return (
    <ModalForm
      label="Attendance"
      buttonClassName="button-quiet button-sm"
      title={`Attendance: ${sheet.topic}`}
      description={sheet.zoom ? 'Filled in from who was on Zoom. Change anything that is wrong, then save.' : 'Choose for each student, or mark everyone present. Leave blank to mark later.'}
      action={markAttendance.bind(null, sheet.sessionId)}
      submitLabel="Save attendance"
      wide
    >
      {sheet.rows.length === 0 ? (
        <p className="muted">Nobody is invited to this class.</p>
      ) : (
        <>
          <div className="toolbar">
            <MarkAllPresent />
            {fromZoom > 0 && <Pill tone="solid">{fromZoom} marked from Zoom</Pill>}
          </div>
          <div className="rows">
            {sheet.rows.map((row) => (
              <label className="field" key={row.studentId}>
                <span>
                  {row.firstName} {row.lastName}
                  {row.zoomMinutes !== undefined && sheet.zoom && (
                    <small className="muted"> · {row.zoomMinutes} of {sheet.zoom.classMinutes} min on Zoom</small>
                  )}
                </span>
                <select name={`status_${row.studentId}`} defaultValue={row.status ?? ''}>
                  <option value="">Not marked</option>
                  {ATTENDANCE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {sheet.zoom && sheet.zoom.unmatched.length > 0 && (
            <p className="muted small">
              Zoom also saw {sheet.zoom.unmatched.map((person) => `${person.name} (${person.minutes} min)`).join(', ')}, who could not be matched to a student. If one of them is a student, mark them above.
            </p>
          )}
        </>
      )}
    </ModalForm>
  );
}

function AttendancePanel({ record }: { record: StudentAttendanceDto }) {
  return (
    <Panel title="Attendance">
      {record.total === 0 ? (
        <None>No attendance has been marked yet.</None>
      ) : (
        <>
          <p>
            {record.present + record.late} of {record.total} classes attended
            {record.late > 0 ? ` (${record.late} late)` : ''}. {record.absent} absent, {record.excused} excused.
          </p>
          <div className="rows">
            {record.recent.map((entry) => (
              <Row key={entry.sessionId} title={entry.topic} sub={entry.startsAt.slice(0, 10)} end={<Pill tone={entry.status === 'absent' ? 'bad' : entry.status === 'late' ? 'warn' : 'good'}>{STATUS_LABEL[entry.status]}</Pill>} />
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

/**
 * Every week of every course the person can reach, named "Course · Chapter 2 · Week 5: Topic".
 * `only` limits it to a teacher's own courses.
 */
async function courseWeekOptions(only: { id: string; name: string }[] | null): Promise<WeekOption[]> {
  let courses: { id: string; name: string }[] = only ? [...new Map(only.map((c) => [c.id, c])).values()] : [];
  if (!only) {
    const all = await callAsUser<{ items: CourseDto[] }>('academic', '/courses?limit=99');
    courses = all.ok ? all.data.items : [];
  }
  const details = await Promise.all(courses.map((course) => callAsUser<CourseDetailDto>('academic', `/courses/${course.id}`)));
  return details.flatMap((detail) =>
    detail.ok
      ? detail.data.weeks.map((week) => {
          const chapter = detail.data.chapters.find((c) => c.id === week.chapterId);
          return {
            value: `${detail.data.id}/${week.id}`,
            label: `${detail.data.name} · ${chapter ? `Chapter ${chapter.number} · ` : ''}Week ${week.number}: ${week.title}`,
          };
        })
      : [],
  );
}

async function StaffSchedule({ month, tz }: { month: string; tz: string }) {
  const [me, sessions, groups, zoom, teaching] = await Promise.all([
    getMe(),
    callAsUser<SessionDto[]>('classes', `/sessions?month=${month}`),
    callAsUser<{ items: GroupDto[] }>('academic', '/groups?limit=100'),
    callAsUser<ZoomConnectionDto>('zoom', '/zoom/connection'),
    getTeaching(),
  ]);
  if (sessions.status === 403) return <Forbidden what="classes" />;
  // A teacher schedules only for the groups where the admin allowed it.
  const schedulable = teaching.filter((g) => g.permissions.includes('classes.schedule'));
  const isTeacher = !me.permissions.includes('tenant.classes.read');
  const can = (action: string) => (isTeacher ? schedulable.length > 0 : me.permissions.includes(`tenant.classes.${action}`));
  const groupList: GroupDto[] = isTeacher
    ? schedulable.map((g) => ({ id: g.id, name: g.name, yearLevel: g.yearLevel, startMonth: '', endMonth: '', status: g.status, memberCount: 0, createdAt: '' }))
    : groups.ok
      ? groups.data.items
      : [];
  const connected = zoom.ok && zoom.data.connected;
  const list = sessions.ok ? sessions.data : [];
  const weekOptions = await courseWeekOptions(isTeacher ? teaching.map((g) => g.courses).flat() : null);
  // A teacher marks attendance only in groups where the admin allowed it.
  const markable = new Set(teaching.filter((g) => g.permissions.includes('attendance.mark')).map((g) => g.id));
  const mayMark = (session: SessionDto) =>
    me.permissions.includes('tenant.attendance.mark') || (session.groups.length > 0 && session.groups.every((g) => markable.has(g.id)));
  const started = list.filter((session) => new Date(session.startsAt).getTime() <= Date.now() && mayMark(session));
  const sheets = new Map<string, AttendanceSheetDto>();
  await Promise.all(
    started.map(async (session) => {
      const sheet = await callAsUser<AttendanceSheetDto>('classes', `/sessions/${session.id}/attendance`);
      if (sheet.ok) sheets.set(session.id, sheet.data);
    }),
  );

  return (
    <>
      <PageHead title="Class schedule" sub={monthTitle(month)}>
        <Link className="button-quiet" href={`/schedule?month=${shiftMonth(month, -1)}`}>
          Previous
        </Link>
        <Link className="button-quiet" href={`/schedule?month=${shiftMonth(month, 1)}`}>
          Next
        </Link>
        {can('create') && connected && (
          <ModalForm label="Schedule a class" title="Schedule a class" action={createSession} submitLabel="Schedule">
            <SessionFields groups={groupList} tz={tz} zoomAccounts={zoom.ok ? zoom.data.accounts : []} weeks={weekOptions} />
            <FormSection title="Repeat">
              <Toggle label="Repeat weekly" name="repeat" hint="Creates one Zoom meeting per week." />
              <Field label="Number of weeks, if repeating" name="weeks" type="number" min={2} max={52} defaultValue={10} />
            </FormSection>
          </ModalForm>
        )}
      </PageHead>
      {!connected && (
        <p className="notice notice-warn">
          Zoom isn&apos;t connected yet.{' '}
          {me.permissions.includes('tenant.zoom.connect') ? (
            <>
              <Link href="/settings">Connect it in Settings</Link> before scheduling classes.
            </>
          ) : (
            'Ask your academy admin to connect it before classes can be scheduled.'
          )}
        </p>
      )}
      <Calendar month={month} tz={tz} sessions={list} today={todayIn(tz)} canEdit={can('update')} groups={groupList} weeks={weekOptions} />
      {list.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">When</th>
                <th scope="col">Groups</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((session) => (
                <tr key={session.id}>
                  <td className="strong">{session.topic}</td>
                  <td className="nowrap">{dateTime(session.startsAt, tz)}</td>
                  <td>{session.groups.map((g) => g.name).join(', ')}</td>
                  <td>
                    {session.status === 'live' ? (
                      <Pill tone="solid">Live now</Pill>
                    ) : session.status === 'missed' ? (
                      <Pill tone="warn">Did not run</Pill>
                    ) : session.status === 'held' ? (
                      <Pill tone="off">Held</Pill>
                    ) : (
                      <Pill>Scheduled</Pill>
                    )}
                    {session.parts.length > 1 && <small>{session.parts.length} Zoom links</small>}
                  </td>
                  <td>
                    <div className="td-actions">
                      {sheets.has(session.id) && <AttendanceModal sheet={sheets.get(session.id)!} />}
                      {can('update') && (session.status === 'upcoming' || session.status === 'live') &&
                        (session.parts.length > 1 ? (
                          session.parts.map((part) => (
                            <ClassButtons key={part.part} kind="host" sessionId={session.id} part={part.part} parts={session.parts.length} small />
                          ))
                        ) : (
                          <ClassButtons kind="host" sessionId={session.id} small rejoin={session.status === 'live'} />
                        ))}
                      {can('update') && session.status === 'missed' && (
                        <RescheduleClass session={session} tz={tz} label="Reschedule" buttonClassName="button button-sm" />
                      )}
                      {can('update') && (session.status === 'upcoming' || session.status === 'live') && (
                        <EditClass session={session} groups={groupList} tz={tz} label="Edit" buttonClassName="button-quiet button-sm" weeks={weekOptions} />
                      )}
                      {can('delete') && (
                        <ModalForm
                          label="Cancel class"
                          buttonClassName="button-danger button-sm"
                          title="Cancel this class?"
                          description="Students and parents will be notified and emailed. The Zoom meeting is removed."
                          action={deleteSession.bind(null, session.id)}
                          submitLabel="Cancel class"
                          submitClassName="button-danger"
                        />
                      )}
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

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; child?: string; when?: string }>;
}) {
  const [me, params, tz] = await Promise.all([getMe(), searchParams, getTimezone()]);

  if (me.kind === 'student' || me.kind === 'parent') {
    let path = '/me/schedule';
    let children: PersonDto[] = [];
    let childId: string | undefined;
    if (me.kind === 'parent') {
      const family = await callAsUser<{ children: PersonDto[] }>('identity', '/me/family');
      children = family.ok ? family.data.children : [];
      childId = children.find((c) => c.id === params.child)?.id ?? children[0]?.id;
      if (!childId) return <Empty icon="users" title="Nobody linked yet" body="Your academy will link your children to this account." heading="h1" />;
      path = `/me/children/${childId}/schedule`;
    }
    const schedule = await callAsUser<LearnerScheduleDto>('classes', path);
    const attendance = await callAsUser<StudentAttendanceDto>('classes', me.kind === 'parent' ? `/me/children/${childId}/attendance` : '/me/attendance');
    const past = params.when === 'past';
    const base = childId ? `/schedule?child=${childId}&` : '/schedule?';
    return (
      <>
        <PageHead title="Class schedule">
          {children.length > 1 && (
            <Tabs label="Child" items={children.map((child) => ({ href: `/schedule?child=${child.id}`, label: child.firstName, current: child.id === childId }))} />
          )}
        </PageHead>
        <Tabs
          label="When"
          items={[
            { href: `${base}when=upcoming`, label: 'Upcoming', current: !past },
            { href: `${base}when=past`, label: 'Past', current: past },
          ]}
        />
        <Panel title={past ? 'Past classes' : 'Upcoming classes'}>
          <SessionRows sessions={schedule.ok ? (past ? schedule.data.past : schedule.data.upcoming) : []} tz={tz} showJoin={!past && me.kind === 'student'} empty={past ? 'No past classes yet.' : 'No classes coming up.'} />
        </Panel>
        {attendance.ok && <AttendancePanel record={attendance.data} />}
      </>
    );
  }

  const month = /^\d{4}-\d{2}$/.test(params.month ?? '') ? params.month! : monthIn(tz);
  return <StaffSchedule month={month} tz={tz} />;
}
