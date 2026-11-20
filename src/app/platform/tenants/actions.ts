'use server';

import type { AcademyRequestDto, TenantDto } from '@edura/contracts';
import { revalidatePath } from 'next/cache';
import type { FormState } from '@/lib/action-form';
import { callAsUser, errorMessage } from '@/lib/server';

const text = (data: FormData, name: string) => String(data.get(name) ?? '');

export async function createTenant(_: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('tenants', '/tenants', {
    method: 'POST',
    body: { name: text(data, 'name'), slug: text(data, 'slug').trim().toLowerCase() },
  });
  if (!result.ok) return { error: errorMessage(result, 'Could not create the tenant') };
  revalidatePath('/platform/tenants');
  return { success: 'Tenant created.' };
}

/** Creates the academy, invites the person who asked, then closes their request. */
export async function approveAcademy(request: AcademyRequestDto, _: FormState): Promise<FormState> {
  const created = await callAsUser<TenantDto>('tenants', '/tenants', {
    method: 'POST',
    body: { name: request.name, slug: request.slug },
  });
  if (!created.ok) return { error: errorMessage(created, 'Could not create this academy') };
  const invited = await callAsUser('identity', `/tenants/${created.data.id}/admin`, {
    method: 'POST',
    body: { email: request.email, firstName: request.firstName, lastName: request.lastName },
  });
  await callAsUser('tenants', `/academy-requests/${request.id}/close`, { method: 'POST', body: { status: 'approved' } });
  revalidatePath('/platform/tenants');
  if (!invited.ok) return { error: 'The academy was created, but the invitation failed. Use Invite admin.' };
  return { success: 'Academy created and invitation sent.' };
}

export async function declineAcademy(id: string, _: FormState): Promise<FormState> {
  const result = await callAsUser('tenants', `/academy-requests/${id}/close`, { method: 'POST', body: { status: 'declined' } });
  if (!result.ok) return { error: errorMessage(result, 'Could not decline this request') };
  revalidatePath('/platform/tenants');
  return {};
}

export async function inviteAdmin(
  tenantId: string,
  _: FormState,
  data: FormData,
): Promise<FormState> {
  const result = await callAsUser('identity', `/tenants/${tenantId}/admin`, {
    method: 'POST',
    body: {
      email: text(data, 'email'),
      firstName: text(data, 'firstName'),
      lastName: text(data, 'lastName'),
    },
  });
  if (!result.ok) return { error: errorMessage(result, 'Could not send the invitation') };
  revalidatePath(`/platform/tenants/${tenantId}`);
  return { success: 'Invitation sent.' };
}

export async function changeTenantState(
  tenantId: string,
  verb: 'suspend' | 'reinstate' | 'provision',
  _: FormState,
): Promise<FormState> {
  const result = await callAsUser('tenants', `/tenants/${tenantId}/${verb}`, { method: 'POST' });
  if (!result.ok) return { error: errorMessage(result, 'That did not work. Please try again.') };
  revalidatePath('/platform/tenants');
  revalidatePath(`/platform/tenants/${tenantId}`);
  return {};
}

/** Takes an academy admin's access away (or gives it back). Any open sign-in stops working at once. */
export async function changeAdminAccess(
  tenantId: string,
  adminId: string,
  verb: 'revoke' | 'restore',
  _: FormState,
): Promise<FormState> {
  const result = await callAsUser('identity', `/tenants/${tenantId}/admins/${adminId}/${verb}`, { method: 'POST' });
  if (!result.ok) return { error: errorMessage(result, 'That did not work. Please try again.') };
  revalidatePath(`/platform/tenants/${tenantId}`);
  return { success: verb === 'revoke' ? 'Access revoked.' : 'Access restored.' };
}

export async function sendAdminLink(tenantId: string, adminId: string, _: FormState): Promise<FormState> {
  const result = await callAsUser('identity', `/tenants/${tenantId}/admins/${adminId}/password-link`, { method: 'POST' });
  if (!result.ok) return { error: errorMessage(result, 'Could not send the link') };
  return { success: 'Link sent.' };
}
