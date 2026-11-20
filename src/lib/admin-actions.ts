'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { CLASS_MODE_COOKIE } from './cookies';
import type { FormState } from './action-form';
import { callAsUser, errorMessage, type ApiResult } from './server';

const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
const refresh = () => revalidatePath('/', 'layout');

function outcome(result: ApiResult, success: string, failure: string): FormState {
  if (!result.ok) return { error: errorMessage(result, failure) };
  refresh();
  return { success };
}

export async function enableMfa(_: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser<{ recoveryCodes: string[] }>('identity', '/auth/mfa/enable', {
    method: 'POST',
    body: { code: text(data, 'code') },
  });
  if (!result.ok) return { error: 'That code is not right. Check the app and try the newest one.' };
  refresh();
  return { success: `Two-step sign-in is on. Save these recovery codes somewhere safe: ${result.data.recoveryCodes.join('  ')}` };
}

export async function disableMfa(_: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('identity', '/auth/mfa/disable', { method: 'POST', body: { code: text(data, 'code') } });
  return outcome(result, 'Two-step sign-in is off.', 'That code is not right, or your academy requires two-step sign-in.');
}

export async function createStaff(_: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('identity', '/staff', {
    method: 'POST',
    body: {
      email: text(data, 'email'),
      firstName: text(data, 'firstName'),
      lastName: text(data, 'lastName'),
      roleIds: data.getAll('roleIds').map(String),
    },
  });
  return outcome(result, 'Added. An invitation email has been sent.', 'Could not add this person');
}

export async function setStaffRoles(id: string, _: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('identity', `/staff/${id}/roles`, {
    method: 'PUT',
    body: { roleIds: data.getAll('roleIds').map(String) },
  });
  return outcome(result, 'Saved.', 'Could not change these roles');
}

export async function setStaffActive(id: string, active: boolean, _: FormState): Promise<FormState> {
  const verb = active ? 'reactivate' : 'deactivate';
  const result = await callAsUser('identity', `/staff/${id}/${verb}`, { method: 'POST' });
  return outcome(result, '', 'That did not work. Please try again.');
}

const roleBody = (data: FormData) => ({
  name: text(data, 'name'),
  ...(text(data, 'description') ? { description: text(data, 'description') } : {}),
  permissions: data.getAll('permissions').map(String),
});

export async function createRole(_: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('identity', '/roles', { method: 'POST', body: roleBody(data) });
  return outcome(result, 'Role created.', 'Could not create this role');
}

export async function updateRole(id: string, _: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('identity', `/roles/${id}`, { method: 'PUT', body: roleBody(data) });
  return outcome(result, 'Saved.', 'Could not save this role');
}

export async function deleteRole(id: string, _: FormState): Promise<FormState> {
  const result = await callAsUser('identity', `/roles/${id}`, { method: 'DELETE' });
  return outcome(result, '', 'Could not delete this role');
}

export async function updateAccount(_: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('identity', '/auth/me', {
    method: 'PATCH',
    body: { firstName: text(data, 'firstName'), lastName: text(data, 'lastName') },
  });
  return outcome(result, 'Saved.', 'Could not save your details');
}

/** Where classes open for this person on this browser: inside Edura, or in the Zoom app. */
export async function setClassMode(_: FormState, data: FormData): Promise<FormState> {
  const mode = data.get('mode') === 'web' ? 'web' : 'app';
  (await cookies()).set(CLASS_MODE_COOKIE, mode, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === 'production',
  });
  revalidatePath('/', 'layout');
  return { success: mode === 'web' ? 'Classes will open here in Edura.' : 'Classes will open in the Zoom app.' };
}

/** Changing a password ends every session, including this one, so the person signs in again. */
export async function changePassword(_: FormState, data: FormData): Promise<FormState> {
  const newPassword = String(data.get('newPassword') ?? '');
  if (newPassword !== String(data.get('confirmPassword') ?? '')) {
    return { error: 'The two passwords do not match' };
  }
  const result = await callAsUser('identity', '/auth/password/change', {
    method: 'POST',
    body: { currentPassword: String(data.get('currentPassword') ?? ''), newPassword },
  });
  if (!result.ok && result.status !== 401) {
    return { error: errorMessage(result, 'Could not change your password') };
  }
  redirect('/login?passwordSet=1');
}
