import type { TenantUsageDto } from '@edura/contracts';
import { callAsUser } from '@/lib/server';
import { Forbidden, PageHead, Pill, Stat } from '@/lib/ui';

export default async function UsagePage() {
  const usage = await callAsUser<TenantUsageDto[]>('tenants', '/usage');
  if (usage.status === 403) return <Forbidden what="usage" />;
  const rows = usage.ok ? usage.data : [];
  const sum = (pick: (row: TenantUsageDto) => number) => rows.reduce((total, row) => total + pick(row), 0);
  return (
    <>
      <PageHead title="Usage" sub="Active parents and students by academy." />
      <div className="stats">
        <Stat value={sum((r) => r.activeStudents)} label="Active students" tone="primary" />
        <Stat value={sum((r) => r.activeParents)} label="Active parents" tone="soft" />
        <Stat value={rows.length} label="Academies" tone="tint" />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Academy</th>
              <th scope="col">Status</th>
              <th scope="col">Active parents</th>
              <th scope="col">Active students</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tenantId}>
                <td className="strong">{row.name}</td>
                <td>
                  <Pill tone={row.status === 'ACTIVE' ? 'good' : row.status === 'SUSPENDED' ? 'bad' : 'warn'}>{row.status === 'ACTIVE' ? 'Active' : row.status === 'SUSPENDED' ? 'Suspended' : 'Setting up'}</Pill>
                </td>
                <td>{row.activeParents}</td>
                <td>{row.activeStudents}</td>
                <td className="strong">{row.activeParents + row.activeStudents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
