import type { SdkJoinDto } from '@edura/contracts';
import Link from 'next/link';
import { callAsUser, errorMessage, getMe } from '@/lib/server';
import { LiveClass } from './live-class';

/**
 * A class run inside Edura. Staff start it as the host, students join it. The same checks as the Start and Join
 * buttons apply: the services refuse anyone who may not, and say why (too early, already over).
 */
export default async function LivePage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ part?: string }>;
}) {
  const [{ sessionId }, { part }, me] = await Promise.all([params, searchParams, getMe()]);
  const query = part && /^\d{1,2}$/.test(part) ? `?part=${part}` : '';
  const isStudent = me.kind === 'student';
  const result = isStudent
    ? await callAsUser<SdkJoinDto>('classes', `/me/sessions/${sessionId}/join-embed${query}`, { method: 'POST' })
    : await callAsUser<SdkJoinDto>('classes', `/sessions/${sessionId}/host-embed${query}`);
  const via = query ? '&via=app' : '?via=app';
  const fallback = isStudent ? `/join-class/${sessionId}${query}${via}` : `/host-class/${sessionId}${query}${via}`;

  if (!result.ok) {
    return (
      <div className="stack">
        <p className="notice notice-error" role="alert">
          {errorMessage(result, 'This class could not be opened here.')}
        </p>
        <p>
          <Link href="/schedule">Back to the schedule</Link>
        </p>
      </div>
    );
  }
  return (
    <LiveClass
      join={result.data}
      userName={`${me.firstName} ${me.lastName}`.trim() || me.email}
      userEmail={me.email}
      fallbackHref={fallback}
      sessionId={sessionId}
      leaveHref={`/live/${sessionId}/ended${query}`}
    />
  );
}
