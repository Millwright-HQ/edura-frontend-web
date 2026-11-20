import type { AuditPageDto, TenantDto } from '@edura/contracts';
import { AuditView } from '@/lib/audit';
import { callAsUser } from '@/lib/server';
import { Forbidden, PageHead } from '@/lib/ui';

type Params = { month?: string; tenantId?: string; action?: string };

export default async function PlatformAuditPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.month) query.set('month', params.month);
  if (params.tenantId) query.set('tenantId', params.tenantId);
  if (params.action) query.set('action', params.action);
  const [log, tenants] = await Promise.all([
    callAsUser<AuditPageDto>('tenants', `/audit-log?${query}`),
    callAsUser<{ items: TenantDto[] }>('tenants', '/tenants?limit=100'),
  ]);
  if (log.status === 403) return <Forbidden what="the audit log" />;
  const page: AuditPageDto = log.ok ? log.data : { month: params.month ?? new Date().toISOString().slice(0, 7), months: [], entries: [], truncated: false };

  return (
    <>
      <PageHead title="Audit log" sub="Every change made on the platform and inside each academy. Looking at something is never recorded." />
      <AuditView
        page={page}
        filters={params}
        tenants={(tenants.ok ? tenants.data.items : []).map((tenant) => ({ id: tenant.id, name: tenant.name }))}
      />
    </>
  );
}
