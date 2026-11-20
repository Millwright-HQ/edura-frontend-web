import { Empty, PageHead, Panel, Row } from '@/lib/ui';
import { getMe } from '@/lib/server';
import { ClassButtons } from '../class-buttons';
import { ReturnToClass } from '../class-window';
import { loadLiveClasses } from '../live-banner';

/** Every class running right now. An admin sees all of them; a teacher only the ones they teach. */
export default async function LiveClassesPage() {
  const me = await getMe();
  const live = await loadLiveClasses(me);
  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return (
    <div className="page">
      <PageHead title="Live classes">
        <span className="muted">{live.length === 0 ? 'Nothing is live' : `${live.length} live now`}</span>
      </PageHead>
      {live.length === 0 ? (
        <Empty icon="video" title="No classes are live right now" body="When a host starts a class it appears here and at the top of every page." />
      ) : (
        <Panel title="Happening now">
          <div className="rows">
            {live.map((session) => (
              <Row
                key={session.id}
                title={session.topic}
                sub={`Started ${time(session.startsAt)}${session.groups.length ? ` · ${session.groups.join(', ')}` : ''}${session.part ? ` · part ${session.part} of ${session.parts}` : ''}`}
                end={
                  <ReturnToClass sessionId={session.id}>
                    <ClassButtons
                      kind="host"
                      sessionId={session.id}
                      {...(session.part ? { part: session.part, parts: session.parts } : {})}
                      small
                      rejoin
                    />
                  </ReturnToClass>
                }
              />
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
