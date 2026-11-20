import type { PersonDto, UserStatsDto } from '@edura/contracts';
import { ModalForm } from '@/lib/action-form';
import { PASSWORD_HINT } from '@/lib/password-hint';
import { callAsUser, getMe } from '@/lib/server';
import { Checks, Field, Forbidden, FormSection, PageHead } from '@/lib/ui';
import { addParent } from '../people-actions';
import { PeopleList, type ListParams } from '../people-list';

export default async function ParentsPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  const [me, params] = await Promise.all([getMe(), searchParams]);
  if (!me.permissions.includes('tenant.users.read')) return <Forbidden what="viewing parents" />;
  const canCreate = me.permissions.includes('tenant.users.create');
  const [stats, students] = await Promise.all([
    callAsUser<UserStatsDto>('identity', '/users/stats'),
    canCreate ? callAsUser<{ items: PersonDto[] }>('identity', '/users?kind=student&limit=100') : null,
  ]);
  return (
    <>
      <PageHead title="Parents" sub={stats.ok ? `${stats.data.activeParents} active` : undefined}>
        {canCreate && (
          <ModalForm label="Add parent" title="Add parent" description="You set the login." action={addParent} submitLabel="Create parent login">
            <div className="form-grid">
              <Field label="First name" name="firstName" />
              <Field label="Last name" name="lastName" />
            </div>
            <Field label="Phone (optional)" name="phone" type="tel" required={false} />
            <FormSection title="Login">
              <div className="form-grid">
                <Field label="Email" name="email" type="email" />
                <Field label="Password" name="password" type="password" autoComplete="new-password" hint={PASSWORD_HINT} />
              </div>
            </FormSection>
            <FormSection title="Students (optional)">
              <Checks
                label="Link existing students"
                name="studentIds"
                options={(students?.ok ? students.data.items : []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
              />
            </FormSection>
          </ModalForm>
        )}
      </PageHead>
      <PeopleList kind="parent" basePath="/parents" params={params} />
    </>
  );
}
