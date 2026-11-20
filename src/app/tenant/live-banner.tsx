import type { LearnerScheduleDto, SessionDto } from '@edura/contracts';
import Link from 'next/link';
import { callAsUser } from '@/lib/server';
import { ClassButtons } from './class-buttons';
import { ReturnToClass } from './class-window';

type Me = { kind: string; permissions: string[] };

export interface LiveClassRow {
  id: string;
  topic: string;
  startsAt: string;
  groups: string[];
  /** The meeting being taught now, when the class is made of several. */
  part?: number;
  parts?: number;
}

/** The meeting of a long class that is being taught at this moment: the last one that has already begun. */
export function currentPart(parts: { startsAt: string }[], now = Date.now()): number | undefined {
  if (parts.length < 2) return undefined;
  let current = 1;
  parts.forEach((part, index) => {
    if (new Date(part.startsAt).getTime() <= now) current = index + 1;
  });
  return current;
}

/** Every class that is live for this person: all of them for an admin, their own groups' for a teacher, theirs for a student. */
export async function loadLiveClasses(me: Me): Promise<LiveClassRow[]> {
  if (me.kind === 'student') {
    const result = await callAsUser<LearnerScheduleDto>('classes', '/me/schedule');
    if (!result.ok) return [];
    return result.data.upcoming
      .filter((session) => session.live)
      .map((session) => {
        const part = session.parts ? currentPart(session.parts) : undefined;
        return { id: session.id, topic: session.topic, startsAt: session.startsAt, groups: [], ...(part ? { part, parts: session.parts?.length } : {}) };
      });
  }
  if (me.kind === 'parent') return [];
  const can = me.permissions.includes('tenant.classes.read') || me.permissions.includes('tenant.teaching.access');
  if (!can) return [];
  const result = await callAsUser<SessionDto[]>('classes', '/live-sessions');
  if (!result.ok) return [];
  return result.data.map((session) => {
    const part = currentPart(session.parts);
    return {
      id: session.id,
      topic: session.topic,
      startsAt: session.startsAt,
      groups: session.groups.map((group) => group.name),
      ...(part ? { part, parts: session.parts.length } : {}),
    };
  });
}

/** A bar at the top of every page while a class is on, so nobody has to go looking for it. */
export async function LiveBanner({ me }: { me: Me }) {
  const live = await loadLiveClasses(me).catch(() => []);
  if (live.length === 0) return null;
  const staff = me.kind !== 'student';
  const shown = live.slice(0, 2);
  return (
    <aside className="live-banner" aria-label="Classes live now">
      <span className="live-dot" aria-hidden="true" />
      <strong>Live now</strong>
      <div className="live-banner-list">
        {shown.map((session) => (
          <div key={session.id} className="live-banner-item">
            <span>
              {session.topic}
              {session.part ? ` · part ${session.part}` : ''}
            </span>
            <ReturnToClass sessionId={session.id}>
              <ClassButtons
                kind={staff ? 'host' : 'join'}
                sessionId={session.id}
                {...(session.part ? { part: session.part, parts: session.parts } : {})}
                small
                rejoin={staff}
              />
            </ReturnToClass>
          </div>
        ))}
      </div>
      {staff && (
        <Link className="live-banner-all" href="/live-classes">
          {live.length > shown.length ? `See all ${live.length}` : 'See all live classes'}
        </Link>
      )}
    </aside>
  );
}
