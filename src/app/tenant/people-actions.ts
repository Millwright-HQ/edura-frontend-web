'use server';

import { revalidatePath } from 'next/cache';
import type { FormState } from '@/lib/action-form';
import { callAsUser, errorMessage, type ApiResult } from '@/lib/server';

const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
const secret = (data: FormData, name: string) => String(data.get(name) ?? '');

function login(data: FormData) {
  return {
    email: text(data, 'email'),
    firstName: text(data, 'firstName'),
    lastName: text(data, 'lastName'),
    password: secret(data, 'password'),
  };
}

function parentLogin(data: FormData) {
  const phone = text(data, 'phone');
  return { ...login(data), ...(phone ? { phone } : {}) };
}

/** Pages are refreshed by their internal path, not the address the visitor sees. */
function refreshPeople() {
  revalidatePath('/tenant', 'layout');
}

function outcome(result: ApiResult, success: string, failure: string): FormState {
  if (!result.ok) return { error: errorMessage(result, failure) };
  refreshPeople();
  return { success };
}

export async function addStudent(_: FormState, data: FormData): Promise<FormState> {
  const parentId = text(data, 'parentId');
  const groupId = text(data, 'groupId');
  const result = await callAsUser<{ id: string }>('identity', '/students', {
    method: 'POST',
    body: { ...login(data), ...(parentId ? { parentId } : {}) },
  });
  if (!result.ok) return { error: errorMessage(result, 'Could not add this student') };
  if (groupId) {
    const added = await callAsUser('academic', `/groups/${groupId}/students`, {
      method: 'POST',
      body: { studentId: result.data.id },
    });
    if (!added.ok) {
      refreshPeople();
      return { error: 'The login was created, but the student could not be added to that group.' };
    }
  }
  refreshPeople();
  return { success: 'Student login created.' };
}

export async function addParent(_: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('identity', '/parents', {
    method: 'POST',
    body: { parent: parentLogin(data), studentIds: data.getAll('studentIds').map(String) },
  });
  return outcome(result, 'Parent login created.', 'Could not add this parent');
}

export async function addStudentToParent(
  parentId: string,
  _: FormState,
  data: FormData,
): Promise<FormState> {
  const result = await callAsUser('identity', `/parents/${parentId}/students`, {
    method: 'POST',
    body: login(data),
  });
  return outcome(result, 'Student login created.', 'Could not add this student');
}

export async function addParentToStudent(
  studentId: string,
  _: FormState,
  data: FormData,
): Promise<FormState> {
  const result = await callAsUser('identity', `/students/${studentId}/parents`, {
    method: 'POST',
    body: parentLogin(data),
  });
  return outcome(result, 'Parent linked.', 'Could not add this parent');
}

export async function setUserPassword(id: string, _: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('identity', `/users/${id}/password`, {
    method: 'POST',
    body: { password: secret(data, 'password') },
  });
  return outcome(result, 'Password changed.', 'Could not change the password');
}

export async function unlinkFamily(
  parentId: string,
  studentId: string,
  _: FormState,
): Promise<FormState> {
  const result = await callAsUser('identity', `/parents/${parentId}/students/${studentId}`, {
    method: 'DELETE',
  });
  return outcome(result, 'Link removed.', 'Could not remove this link');
}

export async function setPersonActive(
  id: string,
  active: boolean,
  _: FormState,
): Promise<FormState> {
  const verb = active ? 'reactivate' : 'deactivate';
  const result = await callAsUser('identity', `/users/${id}/${verb}`, { method: 'POST' });
  return outcome(result, active ? 'Account reactivated.' : 'Account deactivated.', 'That did not work. Please try again.');
}

/**
 * Approves the request: each new person is emailed their own temporary password. If a student group was chosen,
 * the new students are put in it straight away.
 */
export async function approveRequest(id: string, _: FormState, data: FormData): Promise<FormState> {
  const groupId = text(data, 'groupId');
  const result = await callAsUser<{ studentIds: string[] }>('identity', `/requests/${id}/approve`, { method: 'POST' });
  if (!result.ok) return { error: errorMessage(result, 'Could not approve this request') };
  if (groupId) {
    let added = 0;
    for (const studentId of result.data.studentIds) {
      const put = await callAsUser('academic', `/groups/${groupId}/students`, { method: 'POST', body: { studentId } });
      if (!put.ok) {
        revalidatePath('/tenant', 'layout');
        return { error: `Approved and logins emailed, but only ${added} of ${result.data.studentIds.length} students were added to the group: ${errorMessage(put, 'could not add the rest')}` };
      }
      added++;
    }
  }
  revalidatePath('/tenant', 'layout');
  return { success: 'Approved. Logins were emailed.' };
}

export async function rejectRequest(
  id: string,
  _: FormState,
  data: FormData,
): Promise<FormState> {
  const reason = text(data, 'reason');
  const result = await callAsUser('identity', `/requests/${id}/reject`, {
    method: 'POST',
    body: reason ? { reason } : {},
  });
  return outcome(result, 'Request rejected.', 'Could not reject this request');
}
