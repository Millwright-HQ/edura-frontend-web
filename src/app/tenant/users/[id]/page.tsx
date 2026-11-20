import type { PersonDto, UserDetailDto } from '@edura/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ModalForm } from '@/lib/action-form';
import { PASSWORD_HINT } from '@/lib/password-hint';
import { callAsUser, getMe } from '@/lib/server';
import { Avatar, Field, Forbidden, IconTile, None, PageHead, Panel, Pill, Row } from '@/lib/ui';
import { loadMemberships } from '../../people-list';
import {
  addParentToStudent,
  addStudentToParent,
  setPersonActive,
  setUserPassword,
  unlinkFamily,
} from '../../people-actions';
import { updatePerson } from '../../v1-actions';

function LoginFields() {
  return (
    <>
      <div className="form-grid">
        <Field label="First name" name="firstName" />
        <Field label="Last name" name="lastName" />
      </div>
      <div className="form-grid">
        <Field label="Email" name="email" type="email" />
        <Field label="Password" name="password" type="password" autoComplete="new-password" hint={PASSWORD_HINT} />
      </div>
    </>
  );
}

function Relative({ person, remove }: { person: PersonDto; remove?: Parameters<typeof ModalForm>[0]['action'] }) {
  return (
    <Row
      lead={<Avatar first={person.firstName} last={person.lastName} />}
      title={
        <Link href={`/users/${person.id}`}>
          {person.firstName} {person.lastName}
        </Link>
      }
      sub={person.email}
      end={
        remove && (
          <ModalForm
            label="Remove link"
            buttonClassName="button-danger button-sm"
            title="Remove this link?"
            description="Both accounts stay. They just stop being connected."
            action={remove}
            submitLabel="Remove link"
            submitClassName="button-danger"
          />
        )
      }
    />
  );
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [me, result] = await Promise.all([getMe(), callAsUser<UserDetailDto>('identity', `/users/${id}`)]);
  if (result.status === 403) return <Forbidden what="this page" />;
  if (!result.ok) notFound();

  const person = result.data;
  const isParent = person.kind === 'parent';
  const relatives = (isParent ? person.children : person.parents) ?? [];
  const canCreate = me.permissions.includes('tenant.users.create');
  const canUpdate = me.permissions.includes('tenant.users.update');
  const canDeactivate = me.permissions.includes('tenant.users.deactivate');
  const active = person.status === 'ACTIVE';
  const name = `${person.firstName} ${person.lastName}`;
  const memberships = !isParent && me.permissions.includes('tenant.groups.read') ? await loadMemberships() : null;
  const groups = memberships?.get(id) ?? [];

  return (
    <>
      <PageHead title={name} sub={isParent ? 'Parent' : 'Student'} back={isParent ? { href: '/parents', label: 'Parents' } : { href: '/students', label: 'Students' }}>
        {canUpdate && (
          <ModalForm label="Edit details" buttonClassName="button-quiet" title={`Edit ${name}`} action={updatePerson.bind(null, id)} submitLabel="Save">
            <div className="form-grid">
              <Field label="First name" name="firstName" defaultValue={person.firstName} />
              <Field label="Last name" name="lastName" defaultValue={person.lastName} />
            </div>
            <Field label="Phone (optional)" name="phone" type="tel" defaultValue={person.phone} required={false} />
          </ModalForm>
        )}
        {canUpdate && active && (
          <ModalForm
            label="Set password"
            buttonClassName="button-quiet"
            title="Set a new password"
            description={`${name} will be signed out everywhere.`}
            action={setUserPassword.bind(null, id)}
            submitLabel="Save password"
          >
            <Field label="New password" name="password" type="password" autoComplete="new-password" hint={PASSWORD_HINT} />
          </ModalForm>
        )}
        {canDeactivate && (
          <ModalForm
            label={active ? 'Deactivate' : 'Reactivate'}
            buttonClassName={active ? 'button-danger' : 'button-quiet'}
            title={active ? `Deactivate ${name}?` : `Reactivate ${name}?`}
            description={active ? 'They can’t sign in until you reactivate them.' : 'They’ll be able to sign in again.'}
            action={setPersonActive.bind(null, id, !active)}
            submitLabel={active ? 'Deactivate' : 'Reactivate'}
            submitClassName={active ? 'button-danger' : 'button'}
          />
        )}
      </PageHead>

      <div className="cols cols-main">
        <Panel
          title={isParent ? 'Children' : 'Parents'}
          action={
            canCreate && active ? (
              isParent ? (
                <ModalForm label="Add student" buttonClassName="button-quiet button-sm" title="Add a student" description={`For ${name}`} action={addStudentToParent.bind(null, id)} submitLabel="Add student">
                  <LoginFields />
                </ModalForm>
              ) : (
                <ModalForm label="Add parent" buttonClassName="button-quiet button-sm" title="Add a parent" description={`For ${name}. If this parent already has a login, it is reused.`} action={addParentToStudent.bind(null, id)} submitLabel="Add parent">
                  <LoginFields />
                  <Field label="Phone (optional)" name="phone" type="tel" required={false} />
                </ModalForm>
              )
            ) : undefined
          }
        >
          {relatives.length === 0 ? (
            <None>{isParent ? 'No students linked yet.' : 'No parent linked. That’s fine: parents are optional.'}</None>
          ) : (
            <div className="rows">
              {relatives.map((relative) => (
                <Relative
                  key={relative.id}
                  person={relative}
                  {...(canUpdate ? { remove: unlinkFamily.bind(null, isParent ? id : relative.id, isParent ? relative.id : id) } : {})}
                />
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Details">
          <dl className="facts">
            <dt>Login email</dt>
            <dd>{person.email}</dd>
            <dt>Phone</dt>
            <dd>{person.phone ?? 'None'}</dd>
            <dt>Status</dt>
            <dd>
              <Pill tone={active ? 'good' : 'off'}>{active ? 'Active' : 'Inactive'}</Pill>
            </dd>
          </dl>
        </Panel>
      </div>

      {memberships && (
        <Panel title="Groups and courses">
          {groups.length === 0 ? (
            <None>Not in a group yet.</None>
          ) : (
            <div className="rows">
              {groups.map((group) => (
                <Row key={group.id} lead={<IconTile name="users" />} title={<Link href={`/groups/${group.id}`}>{group.name}</Link>} sub={group.courses.join(', ') || 'No courses yet'} />
              ))}
            </div>
          )}
        </Panel>
      )}
    </>
  );
}
