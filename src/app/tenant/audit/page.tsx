import type { AuditPageDto } from '@edura/contracts';
import { AuditView } from '@/lib/audit';
import { callAsUser } from '@/lib/server';
import { getTimezone } from '@/lib/site';
import { Forbidden, PageHead } from '@/lib/ui';

type Params = { month?: string; action?: string };

export default async function TenantAuditPage({ searchParams }: { searchParams: Promise<Params> }) {
  const [params, timeZone] = await Promise.all([searchParams, getTimezone()]);
  const query = new URLSearchParams();
  if (params.month) query.set('month', params.month);
  if (params.action) query.set('action', params.action);
  const log = await callAsUser<AuditPageDto>('identity', `/audit?${query}`);
  if (log.status === 403) return <Forbidden what="the audit log" />;
  const page: AuditPageDto = log.ok ? log.data : { month: params.month ?? new Date().toISOString().slice(0, 7), months: [], entries: [], truncated: false };

  return (
    <>
      <PageHead title="Audit log" sub="Every change made by your admins, staff, parents and students. Looking at something is never recorded." />
      <AuditView page={page} filters={params} timeZone={timeZone} />
    </>
  );
}
