import type { GroupDetailDto, GroupDto, PersonDto, UserDetailDto } from '@edura/contracts';
import Link from 'next/link';
import { callAsUser, getMe } from '@/lib/server';
import { Avatar, None, Pill, Tabs } from '@/lib/ui';

export interface ListParams {
  status?: string;
  search?: string;
  cursor?: string;
}

/** Each group a student belongs to, keyed by student id. */
export async function loadMemberships() {
  const groups = await callAsUser<{ items: GroupDto[] }>('academic', '/groups?limit=100');
  const details = groups.ok
    ? await Promise.all(groups.data.items.map((group) => callAsUser<GroupDetailDto>('academic', `/groups/${group.id}`)))
    : [];
  const byStudent = new Map<string, { id: string; name: string; courses: string[] }[]>();
  for (const detail of details) {
    if (!detail.ok) continue;
    for (const member of detail.data.members) {
      const entry = { id: detail.data.id, name: detail.data.name, courses: detail.data.courses.map((c) => c.name) };
      byStudent.set(member.id, [...(byStudent.get(member.id) ?? []), entry]);
    }
  }
  return byStudent;
}

/** Shared list for parents and students: status tabs, surname search and paging. */
export async function PeopleList({
  kind,
  basePath,
  params,
}: {
  kind: 'parent' | 'student';
  basePath: string;
  params: ListParams;
}) {
  const status = params.status === 'inactive' ? 'inactive' : 'active';
  const search = params.search?.trim() ?? '';
  const query = new URLSearchParams({ kind, status, limit: '25' });
  if (search) query.set('search', search);
  if (params.cursor) query.set('cursor', params.cursor);
  const me = await getMe();
  const canSeeGroups = me.permissions.includes('tenant.groups.read');
  const [result, memberships] = await Promise.all([
    callAsUser<{ items: PersonDto[]; nextCursor?: string }>('identity', `/users?${query}`),
    kind === 'student' && canSeeGroups ? loadMemberships() : null,
  ]);
  if (!result.ok) return <p className="notice notice-error">This list could not be loaded.</p>;

  const details = new Map(
    (await Promise.all(result.data.items.map((person) => callAsUser<UserDetailDto>('identity', `/users/${person.id}`))))
      .filter((detail) => detail.ok)
      .map((detail) => [detail.data.id, detail.data]),
  );
  const link = (next: Record<string, string>) => {
    const out = new URLSearchParams({ status, ...(search ? { search } : {}), ...next });
    return `${basePath}?${out}`;
  };
  const relatives = (person: PersonDto) => {
    const detail = details.get(person.id);
    const list = (kind === 'parent' ? detail?.children : detail?.parents) ?? [];
    if (list.length > 0) return list.map((p) => (kind === 'parent' ? p.firstName : `${p.firstName} ${p.lastName}`)).join(', ');
    return kind === 'parent' ? 'None yet' : 'No parent';
  };

  return (
    <>
      <div className="toolbar">
        <Tabs
          label="Status"
          items={[
            { href: `${basePath}?status=active`, label: 'Active', current: status === 'active' },
            { href: `${basePath}?status=inactive`, label: 'Inactive', current: status === 'inactive' },
          ]}
        />
        <form className="search" action={basePath}>
          <input type="hidden" name="status" value={status} />
          <input name="search" defaultValue={search} placeholder="Search by surname" aria-label="Search by surname" />
          <button className="button-quiet" type="submit">
            Search
          </button>
        </form>
      </div>
      {result.data.items.length === 0 ? (
        <section className="panel">
          <None>Nobody to show here.</None>
        </section>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Login email</th>
                {kind === 'parent' && <th scope="col">Phone</th>}
                {memberships && <th scope="col">Group</th>}
                <th scope="col">{kind === 'parent' ? 'Students' : 'Parent'}</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.data.items.map((person) => (
                <tr key={person.id}>
                  <td>
                    <span className="cell-person">
                      <Avatar first={person.firstName} last={person.lastName} />
                      <Link href={`/users/${person.id}`}>
                        {person.firstName} {person.lastName}
                      </Link>
                    </span>
                  </td>
                  <td>{person.email}</td>
                  {kind === 'parent' && <td>{person.phone ?? 'None'}</td>}
                  {memberships && <td>{memberships.get(person.id)?.map((g) => g.name).join(', ') ?? 'None yet'}</td>}
                  <td className="muted">{relatives(person)}</td>
                  <td>
                    <Pill tone={status === 'active' ? 'good' : 'off'}>{status === 'active' ? 'Active' : 'Inactive'}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result.data.nextCursor && (
        <p>
          <Link href={link({ cursor: result.data.nextCursor })}>Next page</Link>
        </p>
      )}
    </>
  );
}
