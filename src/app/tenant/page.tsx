import { ClassButtons } from './class-buttons';
import type {
  AnnouncementDto,
  ContinueWatchingDto,
  InvoiceStatsDto,
  LearnerScheduleDto,
  LearnerSessionDto,
  LearnerSummaryDto,
  ParentInvoicesDto,
  PersonDto,
  SessionDto,
  UserStatsDto,
} from '@edura/contracts';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dateTime, dayParts, money, monthIn, niceDate, timeOf } from '@/lib/format';
import { glyphFor, minutesLeft, posterClass } from '@/lib/poster';
import { callAsUser, getMe, type Me } from '@/lib/server';
import { getTimezone } from '@/lib/site';
import { Empty, IconTile, None, PageHead, Panel, Pill, Row, Stat, Tabs } from '@/lib/ui';

function startsLabel(session: LearnerSessionDto, tz: string) {
  const minutes = Math.round((new Date(session.startsAt).getTime() - Date.now()) / 60_000);
  if (minutes <= 0) return 'Live now';
  if (minutes < 60) return `Live class starts in ${minutes} min`;
  return `Next live class · ${dateTime(session.startsAt, tz)}`;
}

function Agenda({ title, sessions, tz, join }: { title: string; sessions: LearnerSessionDto[]; tz: string; join: boolean }) {
  return (
    <Panel title={title}>
      {sessions.length === 0 ? (
        <None>No classes coming up.</None>
      ) : (
        <div className="rows">
          {sessions.map((session) => {
            const { day, num } = dayParts(session.startsAt, tz);
            return (
              <Row
                key={session.id}
                lead={
                  <span className="date-tile">
                    {day}
                    <b>{num}</b>
                  </span>
                }
                title={session.topic}
                sub={`${timeOf(session.startsAt, tz)} · ${session.durationMinutes} minutes`}
                end={
                  join && session.canJoin ? (
                    <ClassButtons kind="join" sessionId={session.id} />
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function Latest({ items }: { items: AnnouncementDto[] }) {
  const latest = items[0];
  if (!latest) {
    return (
      <div className="callout">
        <span className="callout-tag">Latest announcement</span>
        <h2>Nothing new</h2>
        <p>Announcements from your academy will appear here.</p>
      </div>
    );
  }
  return (
    <div className="callout">
      <span className="callout-tag">Latest announcement</span>
      <h2>{latest.title}</h2>
      <p className="prose">{latest.body}</p>
      <div className="actions">
        <Link className="button-quiet" href="/announcements">
          All announcements
        </Link>
      </div>
    </div>
  );
}

async function StudentHome({ tz }: { tz: string }) {
  const [schedule, learner, news, continuing] = await Promise.all([
    callAsUser<LearnerScheduleDto>('classes', '/me/schedule'),
    callAsUser<LearnerSummaryDto>('academic', '/me/courses'),
    callAsUser<AnnouncementDto[]>('comms', '/me/announcements'),
    callAsUser<ContinueWatchingDto[]>('academic', '/me/continue-watching'),
  ]);
  const upcoming = schedule.ok ? schedule.data.upcoming : [];
  const next = upcoming[0];
  const watching = continuing.ok ? continuing.data : [];
  const courses = learner.ok ? learner.data.courses : [];
  const resume = watching[0];
  const viewLink = (v: ContinueWatchingDto) => `/view/${v.courseId}/${v.weekId}/${v.itemId}`;

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          {next ? (
            <>
              <span className="hero-pill">{startsLabel(next, tz)}</span>
              <h1>{next.topic}</h1>
              <p>
                {dateTime(next.startsAt, tz)} · {next.durationMinutes} minutes
              </p>
            </>
          ) : (
            <>
              <span className="hero-pill">No live class coming up</span>
              <h1>Keep learning</h1>
              <p>Your recordings and worksheets are ready whenever you are.</p>
            </>
          )}
          <div className="hero-actions">
            {next?.canJoin && (
              <ClassButtons kind="join" sessionId={next.id} />
            )}
            {next && !next.canJoin && <span className="hero-ghost is-disabled">Opens 15 minutes before</span>}
            {resume ? (
              <Link className="hero-ghost" href={viewLink(resume)}>
                Continue watching
              </Link>
            ) : (
              <Link className="hero-ghost" href="/my-courses">
                My courses
              </Link>
            )}
          </div>
        </div>
        <svg className="hero-art" width="260" height="200" viewBox="0 0 260 200" aria-hidden="true">
          <path d="M20 170H240M130 190V10" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M45 18C80 210 180 210 215 18" stroke="#ff7a50" strokeWidth="10" strokeLinecap="round" fill="none" />
          <path d="M118 138a12 12 0 1 0 24 0a12 12 0 1 0-24 0z" fill="#fff" />
        </svg>
      </section>

      {watching.length > 0 && (
        <section className="section">
          <h2>Continue watching</h2>
          <div className="video-grid">
            {watching.map((video, index) => (
              <Link className="video-card" href={viewLink(video)} key={video.itemId}>
                <span className={`video-thumb ${posterClass(index)}`}>
                  {glyphFor(video.courseName)}
                  <span className="video-left">{minutesLeft(video.positionSeconds, video.durationSeconds)}</span>
                </span>
                <span className="video-bar">
                  <span style={{ width: `${Math.round((video.positionSeconds / video.durationSeconds) * 100)}%` }} />
                </span>
                <span className="video-meta">
                  {video.title}
                  <small>
                    {video.courseName} · Week {video.weekNumber}
                  </small>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <h2>My courses</h2>
        {courses.length === 0 ? (
          <Empty icon="file" title="No courses yet" body="You’ll see your courses here once you’re added to a group." />
        ) : (
          <div className="poster-grid">
            {courses.map((course, index) => (
              <Link className={`poster ${posterClass(index)}`} href={`/learn/${course.id}`} key={course.id}>
                <span className="poster-glyph">{glyphFor(course.name)}</span>
                <span>
                  <span className="poster-name">{course.name}</span>
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
      </section>

      <div className="cols">
        <Agenda title="This week" sessions={upcoming.slice(0, 4)} tz={tz} join />
        <Latest items={news.ok ? news.data : []} />
      </div>
    </>
  );
}

async function ParentHome({ me, tz, childParam }: { me: Me; tz: string; childParam?: string | undefined }) {
  const [family, invoices, news] = await Promise.all([
    callAsUser<{ children: PersonDto[] }>('identity', '/me/family'),
    callAsUser<ParentInvoicesDto>('billing', '/me/invoices'),
    callAsUser<AnnouncementDto[]>('comms', '/me/announcements'),
  ]);
  const children = family.ok ? family.data.children : [];
  const child = children.find((c) => c.id === childParam) ?? children[0];
  const [schedule, learner] = child
    ? await Promise.all([
        callAsUser<LearnerScheduleDto>('classes', `/me/children/${child.id}/schedule`),
        callAsUser<LearnerSummaryDto>('academic', `/me/children/${child.id}/courses`),
      ])
    : [null, null];
  const currency = invoices.ok ? (invoices.data.invoices[0]?.currency ?? '') : '';

  return (
    <>
      <PageHead title={`Welcome, ${me.firstName}`}>
        {children.length > 1 && (
          <Tabs label="Child" items={children.map((c) => ({ href: `/?child=${c.id}`, label: c.firstName, current: c.id === child?.id }))} />
        )}
      </PageHead>
      {invoices.ok && invoices.data.outstandingCents > 0 && (
        <div className="callout">
          <div className="callout-row">
            <div>
              <span className="callout-tag">Outstanding{invoices.data.nextDueDate ? ` · next due ${niceDate(invoices.data.nextDueDate)}` : ''}</span>
              <p className="callout-amount">{money(invoices.data.outstandingCents, currency)}</p>
            </div>
            <Link className="button" href="/invoices">
              View invoices
            </Link>
          </div>
        </div>
      )}
      {!child ? (
        <Empty icon="users" title="Nobody linked yet" body="Your academy will link your children to this account." />
      ) : (
        <div className="cols">
          <Agenda title={`${child.firstName}’s upcoming classes`} sessions={schedule?.ok ? schedule.data.upcoming.slice(0, 5) : []} tz={tz} join={false} />
          <Panel title={`${child.firstName}’s courses`}>
            {learner?.ok && learner.data.courses.length > 0 ? (
              <div className="rows">
                {learner.data.courses.map((course, index) => (
                  <Row
                    key={course.id}
                    lead={<IconTile name="file" alt={index % 2 === 1} />}
                    title={course.name}
                    sub={
                      <>
                        {course.progress ? `${course.progress.chaptersDone} of ${course.progress.chaptersTotal} chapters completed` : course.description}
                        {course.chapters && (
                          <span className="chapter-chips">
                            {course.chapters.map((chapter) => (
                              <Pill key={chapter.id} tone={chapter.completed ? 'good' : 'off'}>
                                {chapter.completed ? '✓ ' : ''}
                                {chapter.title}
                              </Pill>
                            ))}
                          </span>
                        )}
                      </>
                    }
                  />
                ))}
              </div>
            ) : (
              <None>Not enrolled in any courses yet.</None>
            )}
          </Panel>
        </div>
      )}
      <Latest items={news.ok ? news.data : []} />
    </>
  );
}

async function StaffHome({ me, tz }: { me: Me; tz: string }) {
  const can = (permission: string) => me.permissions.includes(permission);
  const month = monthIn(tz);
  const [stats, finance, sessions] = await Promise.all([
    can('tenant.users.read') ? callAsUser<UserStatsDto>('identity', '/users/stats') : null,
    can('tenant.invoices.read') ? callAsUser<InvoiceStatsDto>('billing', `/invoices/stats?month=${month}`) : null,
    can('tenant.classes.read') ? callAsUser<SessionDto[]>('classes', `/sessions?month=${month}`) : null,
  ]);
  const now = Date.now();
  const all = sessions?.ok ? sessions.data : [];
  // A class stays here, with its Start button, for the whole of its duration, not just until it begins.
  const coming = all.filter((s) => s.status === 'upcoming' || s.status === 'live');
  const weekEnd = now + 7 * 86_400_000;
  const thisWeek = coming.filter((s) => new Date(s.startsAt).getTime() < weekEnd).length;
  const plain = (cents: number) => (cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 });

  return (
    <>
      <PageHead title={`Welcome, ${me.firstName}`}>
        {can('tenant.announcements.create') && (
          <Link className="button-quiet" href="/announcements">
            Post announcement
          </Link>
        )}
        {can('tenant.classes.create') && (
          <Link className="button" href="/schedule">
            Schedule a class
          </Link>
        )}
      </PageHead>
      {stats?.ok && (
        <div className="stats">
          <Stat value={stats.data.pendingRequests} label="Pending requests" tone="primary" href="/requests" />
          <Stat value={stats.data.activeParents} label="Active parents" tone="soft" href="/parents" />
          <Stat value={stats.data.activeStudents} label="Active students" tone="tint" href="/students" />
          {sessions?.ok && <Stat value={thisWeek} label="Classes this week" tone="accent" href="/schedule" />}
        </div>
      )}
      <div className="cols">
        {sessions?.ok && (
          <Panel title="Coming up">
            {coming.length === 0 ? (
              <None>No classes scheduled.</None>
            ) : (
              <div className="rows">
                {coming.slice(0, 5).map((session) => {
                  const { day, num } = dayParts(session.startsAt, tz);
                  return (
                    <Row
                      key={session.id}
                      lead={
                        <span className="date-tile">
                          {day}
                          <b>{num}</b>
                        </span>
                      }
                      title={session.topic}
                      sub={`${timeOf(session.startsAt, tz)} · ${session.groups.map((g) => g.name).join(', ')}`}
                      end={
                        can('tenant.classes.update') ? (
                          session.parts.length > 1 ? (
                            <>
                              {session.parts.map((part) => (
                                <ClassButtons key={part.part} kind="host" sessionId={session.id} part={part.part} parts={session.parts.length} small />
                              ))}
                            </>
                          ) : (
                            <ClassButtons kind="host" sessionId={session.id} small rejoin={session.status === 'live'} />
                          )
                        ) : undefined
                      }
                    />
                  );
                })}
              </div>
            )}
          </Panel>
        )}
        {finance?.ok && (
          <Panel title="This month’s fees" action={<Link href="/invoices">Open invoices</Link>}>
            <div className="meter" role="img" aria-label={`${finance.data.collectedPercent}% collected`}>
              <span style={{ width: `${finance.data.collectedPercent}%` }} />
            </div>
            <dl className="facts">
              <dt>Invoiced</dt>
              <dd>{plain(finance.data.invoicedCents)}</dd>
              <dt>Paid ({finance.data.collectedPercent}%)</dt>
              <dd>{plain(finance.data.paidCents)}</dd>
              <dt>Unpaid</dt>
              <dd>{plain(finance.data.pendingCents + finance.data.overdueCents)}</dd>
            </dl>
          </Panel>
        )}
      </div>
    </>
  );
}

export default async function TenantHome({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const [me, tz, params] = await Promise.all([getMe(), getTimezone(), searchParams]);
  if (me.kind === 'student') return <StudentHome tz={tz} />;
  if (me.kind === 'parent') return <ParentHome me={me} tz={tz} childParam={params.child} />;
  if (me.permissions.includes('tenant.teaching.access') && !me.permissions.includes('tenant.dashboard.view')) {
    redirect('/teaching');
  }
  return <StaffHome me={me} tz={tz} />;
}
