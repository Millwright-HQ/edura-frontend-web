import type { GroupDto, PersonDto, UserStatsDto } from '@edura/contracts';
import { ModalForm } from '@/lib/action-form';
import { PASSWORD_HINT } from '@/lib/password-hint';
import { callAsUser, getMe } from '@/lib/server';
import { Field, Forbidden, FormSection, PageHead, Select } from '@/lib/ui';
import { addStudent } from '../people-actions';
import { PeopleList, type ListParams } from '../people-list';

export default async function StudentsPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  const [me, params] = await Promise.all([getMe(), searchParams]);
  if (!me.permissions.includes('tenant.users.read')) return <Forbidden what="viewing students" />;
  const canCreate = me.permissions.includes('tenant.users.create');
  const [stats, parents, groups] = await Promise.all([
    callAsUser<UserStatsDto>('identity', '/users/stats'),
    canCreate ? callAsUser<{ items: PersonDto[] }>('identity', '/users?kind=parent&limit=100') : null,
    canCreate && me.permissions.includes('tenant.groups.manage_students')
      ? callAsUser<{ items: GroupDto[] }>('academic', '/groups?limit=100')
      : null,
  ]);
  return (
    <>
      <PageHead title="Students" sub={stats.ok ? `${stats.data.activeStudents} active` : undefined}>
        {canCreate && (
          <ModalForm label="Add student" title="Add student" description="You set the login. Share it with the student." action={addStudent} submitLabel="Create student login">
            <div className="form-grid">
              <Field label="First name" name="firstName" />
              <Field label="Last name" name="lastName" />
            </div>
            <FormSection title="Login">
              <div className="form-grid">
                <Field label="Email" name="email" type="email" hint="They sign in with this." />
                <Field label="Password" name="password" type="password" autoComplete="new-password" hint={PASSWORD_HINT} />
              </div>
            </FormSection>
            <FormSection title="Optional">
              <div className="form-grid">
                <Select
                  label="Parent"
                  name="parentId"
                  required={false}
                  options={[
                    { value: '', label: 'No parent' },
                    ...(parents?.ok ? parents.data.items : []).map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` })),
                  ]}
                />
                {groups && (
                  <Select
                    label="Group"
                    name="groupId"
                    required={false}
                    options={[
                      { value: '', label: 'No group yet' },
                      ...(groups.ok ? groups.data.items : []).map((g) => ({ value: g.id, label: g.name })),
                    ]}
                  />
                )}
              </div>
            </FormSection>
          </ModalForm>
        )}
      </PageHead>
      <PeopleList kind="student" basePath="/students" params={params} />
    </>
  );
}
