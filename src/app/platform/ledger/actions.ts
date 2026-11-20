'use server';

import { revalidatePath } from 'next/cache';
import type { FormState } from '@/lib/action-form';
import { callAsUser, errorMessage } from '@/lib/server';

const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();

export async function createEntry(_: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('tenants', '/ledger', {
    method: 'POST',
    body: {
      tenantId: text(data, 'tenantId'),
      description: text(data, 'description'),
      amountCents: Math.round(Number(text(data, 'amount')) * 100),
      currency: text(data, 'currency'),
      issueDate: text(data, 'issueDate'),
      dueDate: text(data, 'dueDate'),
    },
  });
  if (!result.ok) return { error: errorMessage(result, 'Could not record this invoice') };
  revalidatePath('/platform/ledger');
  return { success: 'Recorded.' };
}

export async function closeEntry(id: string, action: 'mark-paid' | 'void', _: FormState): Promise<FormState> {
  const result = await callAsUser('tenants', `/ledger/${id}/${action}`, { method: 'POST' });
  if (!result.ok) return { error: errorMessage(result, 'That did not work. Please try again.') };
  revalidatePath('/platform/ledger');
  return {};
}
