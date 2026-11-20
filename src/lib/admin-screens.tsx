import { ALL_PLATFORM_PERMISSIONS, ALL_TENANT_PERMISSIONS } from '@edura/contracts';
import type { MfaSetupDto, MfaStatusDto } from '@edura/contracts';
import Link from 'next/link';
import { ActionForm, ModalForm } from './action-form';
import {
  changePassword,
  createRole,
  createStaff,
  deleteRole,
  disableMfa,
  enableMfa,
  setClassMode,
  setStaffActive,
  setStaffRoles,
  updateAccount,
  updateRole,
} from './admin-actions';
import { ImagePicker } from './image-picker';
import { PASSWORD_HINT } from './password-hint';
import { callAsUser, getClassMode, getMe, type Me } from './server';
import { Avatar, Checks, Field, Forbidden, FormSection, IconTile, None, PageHead, Panel, Pill, Row, Select, Tabs } from './ui';

type Scope = 'platform' | 'tenant';

interface RoleRow {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  system: boolean;
}

interface StaffRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleIds: string[];
}

/** Parents and students get their roles through enrolment, never from this screen. */
const FAMILY_ROLES = new Set(['tenant_parent', 'tenant_student']);

function RoleChecks({ roles, selected }: { roles: RoleRow[]; selected: string[] }) {
  return <Checks label="Roles" name="roleIds" options={roles.filter((r) => !FAMILY_ROLES.has(r.id)).map((r) => ({ value: r.id, label: r.name }))} selected={selected} />;
}

export async function StaffScreen({ scope, status }: { scope: Scope; status: string }) {
  const showing = status === 'inactive' ? 'inactive' : 'active';
  const [me, staff, roles] = await Promise.all([
    getMe(),
    callAsUser<{ items: StaffRow[] }>('identity', `/staff?status=${showing}&limit=100`),
    callAsUser<RoleRow[]>('identity', '/roles'),
  ]);
  if (staff.status === 403) return <Forbidden what="staff accounts" />;
  const can = (action: string) => me.permissions.includes(`${scope}.staff.${action}`);
  const roleList = roles.ok ? roles.data : [];
  const roleName = (id: string) => roleList.find((role) => role.id === id)?.name ?? 'Removed role';
  const people = staff.ok ? staff.data.items : [];

  return (
    <>
      <PageHead title={scope === 'platform' ? 'Platform staff' : 'Staff'}>
        {can('create') && (
          <ModalForm label="Add staff" title="Add staff" description="They’ll get an email to set a password." action={createStaff} submitLabel="Add and invite">
            <div className="form-grid">
              <Field label="First name" name="firstName" />
              <Field label="Last name" name="lastName" />
            </div>
            <Field label="Email" name="email" type="email" />
            <RoleChecks roles={roleList} selected={[]} />
          </ModalForm>
        )}
      </PageHead>
      <Tabs
        label="Status"
        items={[
          { href: '/staff?status=active', label: 'Active', current: showing === 'active' },
          { href: '/staff?status=inactive', label: 'Inactive', current: showing === 'inactive' },
        ]}
      />
      {people.length === 0 ? (
        <Panel>
          <None>Nobody here.</None>
        </Panel>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Roles</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => {
                const name = `${person.firstName} ${person.lastName}`;
                return (
                  <tr key={person.id}>
                    <td>
                      <span className="cell-person strong">
                        <Avatar first={person.firstName} last={person.lastName} />
                        {name}
                      </span>
                    </td>
                    <td>{person.email}</td>
                    <td>{person.roleIds.map(roleName).join(', ')}</td>
                    <td>
                      <Pill tone={showing === 'active' ? 'good' : 'off'}>{showing === 'active' ? 'Active' : 'Inactive'}</Pill>
                    </td>
                    <td>
                      {person.id !== me.id && (
                        <div className="td-actions">
                          {can('update') && showing === 'active' && (
                            <ModalForm label="Edit roles" buttonClassName="button-quiet button-sm" title={name} description="Choose what this person can do." action={setStaffRoles.bind(null, person.id)} submitLabel="Save roles">
                              <RoleChecks roles={roleList} selected={person.roleIds} />
                            </ModalForm>
                          )}
                          {can('deactivate') && (
                            <ModalForm
                              label={showing === 'active' ? 'Deactivate' : 'Reactivate'}
                              buttonClassName={showing === 'active' ? 'button-danger button-sm' : 'button-quiet button-sm'}
                              title={showing === 'active' ? `Deactivate ${name}?` : `Reactivate ${name}?`}
                              action={setStaffActive.bind(null, person.id, showing !== 'active')}
                              submitLabel={showing === 'active' ? 'Deactivate' : 'Reactivate'}
                              submitClassName={showing === 'active' ? 'button-danger' : 'button'}
                            />
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function PermissionChecks({ scope, selected }: { scope: Scope; selected: string[] }) {
  const keys: readonly string[] = scope === 'platform' ? ALL_PLATFORM_PERMISSIONS : ALL_TENANT_PERMISSIONS;
  const modules = new Map<string, string[]>();
  for (const permission of keys) {
    const module = permission.split('.')[1]!;
    modules.set(module, [...(modules.get(module) ?? []), permission]);
  }
  const words = (value: string) => {
    const text = value.replaceAll('_', ' ');
    return text[0]!.toUpperCase() + text.slice(1);
  };
  return (
    <>
      {[...modules].map(([module, permissions]) => (
        <FormSection title={words(module)} key={module}>
          <Checks label="Permissions" name="permissions" options={permissions.map((p) => ({ value: p, label: words(p.split('.')[2]!) }))} selected={selected} />
        </FormSection>
      ))}
    </>
  );
}

export async function RolesScreen({ scope }: { scope: Scope }) {
  const [me, roles] = await Promise.all([getMe(), callAsUser<RoleRow[]>('identity', '/roles')]);
  if (roles.status === 403) return <Forbidden what="roles" />;
  const can = (action: string) => me.permissions.includes(`${scope}.roles.${action}`);
  const list = roles.ok ? roles.data : [];

  return (
    <>
      <PageHead title={scope === 'platform' ? 'Platform roles' : 'Roles'}>
        {can('create') && (
          <ModalForm label="Add role" title="Add role" action={createRole} submitLabel="Add role" wide>
            <div className="form-grid">
              <Field label="Name" name="name" />
              <Field label="Description (optional)" name="description" required={false} />
            </div>
            <PermissionChecks scope={scope} selected={[]} />
          </ModalForm>
        )}
      </PageHead>
      <Panel>
        <div className="rows">
          {list.map((role, index) => (
            <Row
              key={role.id}
              lead={<IconTile name="shield" alt={index % 2 === 1} />}
              title={role.name}
              sub={role.description ?? `${role.permissions.length} permissions`}
              end={
                role.system ? (
                  <Pill tone="off">Built in</Pill>
                ) : (
                  <>
                    {can('update') && (
                      <ModalForm label="Edit" buttonClassName="button-quiet button-sm" title={`Edit ${role.name}`} action={updateRole.bind(null, role.id)} submitLabel="Save role" wide>
                        <div className="form-grid">
                          <Field label="Name" name="name" defaultValue={role.name} />
                          <Field label="Description (optional)" name="description" defaultValue={role.description} required={false} />
                        </div>
                        <PermissionChecks scope={scope} selected={role.permissions} />
                      </ModalForm>
                    )}
                    {can('delete') && (
                      <ModalForm label="Delete" buttonClassName="button-danger button-sm" title={`Delete ${role.name}?`} action={deleteRole.bind(null, role.id)} submitLabel="Delete" submitClassName="button-danger" />
                    )}
                  </>
                )
              }
            />
          ))}
        </div>
      </Panel>
    </>
  );
}

export async function AccountScreen({ me, setup }: { me: Me; setup?: boolean }) {
  const status = (await callAsUser<MfaStatusDto>('identity', '/auth/mfa')).data;
  // Photos live with the academy's files, so platform staff (no academy) have none.
  const photo = me.kind === 'platform_staff' ? undefined : (await callAsUser<{ url: string }>('academic', `/media/people/${me.id}/photo`));
  // Only hand out a new key when the person asked for one.
  const key = setup && status && !status.enabled ? (await callAsUser<MfaSetupDto>('identity', '/auth/mfa/setup', { method: 'POST' })).data : undefined;
  return (
    <>
      <PageHead title="My account" sub="Your name and password.">
        <ModalForm label="Edit details" buttonClassName="button-quiet" title="Your details" action={updateAccount} submitLabel="Save changes">
          <div className="form-grid">
            <Field label="First name" name="firstName" defaultValue={me.firstName} autoComplete="given-name" />
            <Field label="Last name" name="lastName" defaultValue={me.lastName} autoComplete="family-name" />
          </div>
        </ModalForm>
        <ModalForm label="Change password" title="Change password" description="You’ll be asked to sign in again afterwards." action={changePassword} submitLabel="Change password">
          <Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" />
          <Field label="New password" name="newPassword" type="password" autoComplete="new-password" hint={PASSWORD_HINT} />
          <Field label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" />
        </ModalForm>
      </PageHead>
      <Panel title="Your details">
        <div className="rows">
          <Row lead={<Avatar first={me.firstName} last={me.lastName} />} title={`${me.firstName} ${me.lastName}`} sub={me.email} />
        </div>
        <p className="muted small">Your sign-in email can be changed by your academy.</p>
      </Panel>
      {me.kind !== 'platform_staff' && (
        <Panel title="Photo">
          <ImagePicker name="photo" purpose="person" label="Profile photo" currentUrl={photo?.ok ? photo.data.url : undefined} refresh />
        </Panel>
      )}
      {me.kind !== 'platform_staff' && (
        <Panel title="Joining classes">
          <p className="muted small">
            Choose where a class opens when you press Join or Start. This is remembered on this browser, so your computer and your phone can differ.
          </p>
          <ActionForm action={setClassMode} submitLabel="Save" submitClassName="button">
            <Select
              label="Open classes"
              name="mode"
              defaultValue={await getClassMode()}
              options={[
                { value: 'app', label: 'In the Zoom app (desktop or mobile)' },
                { value: 'web', label: 'Here in Edura, in the browser' },
              ]}
            />
          </ActionForm>
        </Panel>
      )}
      {status && (
        <Panel title="Two-step sign-in">
          <div className="rows">
            <Row
              lead={<IconTile name="shield" />}
              title={status.enabled ? 'On' : 'Off'}
              sub={
                status.enabled
                  ? `Codes from your authenticator app are asked for at sign-in. ${status.recoveryCodesLeft} recovery codes left.`
                  : 'Ask for a code from an authenticator app when signing in.'
              }
              end={
                status.enabled ? (
                  status.required ? (
                    <Pill>Required for your role</Pill>
                  ) : (
                    <ModalForm label="Turn off" buttonClassName="button-danger button-sm" title="Turn off two-step sign-in?" description="Enter a code from your app, or a recovery code." action={disableMfa} submitLabel="Turn off" submitClassName="button-danger">
                      <Field label="Code" name="code" autoComplete="one-time-code" />
                    </ModalForm>
                  )
                ) : key ? undefined : (
                  <Link className="button button-sm" href="?mfa=setup">
                    Turn on
                  </Link>
                )
              }
            />
          </div>
          {key && (
            <>
              <p>
                In your authenticator app choose <strong>Add account</strong> then <strong>Enter a setup key</strong>, and type this key:
              </p>
              <p className="mono" translate="no" aria-label="Setup key">
                {key.secret}
              </p>
              <ActionForm action={enableMfa} submitLabel="Turn on">
                <Field label="6-digit code from the app" name="code" autoComplete="one-time-code" />
              </ActionForm>
            </>
          )}
        </Panel>
      )}
    </>
  );
}
