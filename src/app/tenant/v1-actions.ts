'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/action-form';
import { zonedToUtc } from '@/lib/format';
import { callAsUser, errorMessage, type ApiResult } from '@/lib/server';
import { getTimezone } from '@/lib/site';

const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
const refresh = () => revalidatePath('/tenant', 'layout');

function outcome(result: ApiResult, success: string, failure: string): FormState {
  if (!result.ok) return { error: errorMessage(result, failure) };
  refresh();
  return { success };
}

async function sessionFields(data: FormData) {
  // "courseId/weekId" from the week picker; empty means the class is not tied to a course week.
  const [courseId, weekId] = text(data, 'week').split('/');
  return {
    ...(courseId && weekId ? { week: { courseId, weekId } } : {}),
    // A ticked box sends "on"; untick it and nothing is emailed.
    sendEmail: data.get('sendEmail') === 'on',
    topic: text(data, 'topic'),
    startsAt: zonedToUtc(text(data, 'startsAt'), await getTimezone()),
    durationMinutes: Number(text(data, 'durationMinutes')),
    groupIds: data.getAll('groupIds').map(String),
    ...(text(data, 'zoomAccountId') ? { zoomAccountId: text(data, 'zoomAccountId') } : {}),
  };
}

export async function createSession(_: FormState, data: FormData): Promise<FormState> {
  const weeks = data.get('repeat') === 'on' ? Number(text(data, 'weeks')) : 1;
  const result = await callAsUser('classes', '/sessions', {
    method: 'POST',
    body: { ...(await sessionFields(data)), weeks },
  });
  return outcome(result, weeks > 1 ? `${weeks} weekly classes scheduled.` : 'Class scheduled.', 'Could not schedule this class');
}

export async function updateSession(id: string, _: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('classes', `/sessions/${id}`, { method: 'PUT', body: await sessionFields(data) });
  return outcome(result, 'Saved.', 'Could not save this class');
}

export async function markAttendance(sessionId: string, _: FormState, data: FormData): Promise<FormState> {
  const entries = [...data.keys()]
    .filter((name) => name.startsWith('status_'))
    .map((name) => ({ studentId: name.slice('status_'.length), status: text(data, name) }))
    .filter((entry) => entry.status);
  if (entries.length === 0) return { error: 'Mark at least one student' };
  const result = await callAsUser('classes', `/sessions/${sessionId}/attendance`, { method: 'PUT', body: { entries } });
  return outcome(result, 'Attendance saved.', 'Could not save attendance');
}

export async function deleteSession(id: string, _: FormState): Promise<FormState> {
  const result = await callAsUser('classes', `/sessions/${id}`, { method: 'DELETE' });
  return outcome(result, '', 'Could not cancel this class');
}

/** The person's own Zoom app. The credentials go straight to the zoom service, which stores them encrypted. */
export async function connectZoom(_: FormState, data: FormData): Promise<FormState> {
  const webhookSecret = text(data, 'webhookSecret');
  const result = await callAsUser<{ authorizeUrl: string }>('zoom', '/zoom/connect', {
    method: 'POST',
    body: { clientId: text(data, 'clientId'), clientSecret: text(data, 'clientSecret'), ...(webhookSecret ? { webhookSecret } : {}) },
  });
  if (result.ok) redirect(result.data.authorizeUrl);
  return outcome(result, '', 'Could not start the Zoom connection');
}

export async function disconnectZoom(accountId: string, _: FormState): Promise<FormState> {
  const result = await callAsUser('zoom', '/zoom/disconnect', { method: 'POST', body: { accountId } });
  return outcome(result, '', 'Could not disconnect Zoom');
}

const cents = (value: string) => Math.round(Number(value) * 100);

function invoiceFields(data: FormData) {
  return {
    description: text(data, 'description'),
    amountCents: cents(text(data, 'amount')),
    issueDate: text(data, 'issueDate'),
    dueDate: text(data, 'dueDate'),
    periodMonth: text(data, 'periodMonth'),
  };
}

export async function createInvoice(_: FormState, data: FormData): Promise<FormState> {
  const [parentId, ...studentIds] = text(data, 'family').split(',');
  const result = await callAsUser('billing', '/invoices', {
    method: 'POST',
    body: { ...invoiceFields(data), parentId, studentIds },
  });
  return outcome(result, 'Invoice sent.', 'Could not create this invoice');
}

interface GroupInvoiceBatch {
  created: number;
  skipped: number;
  merged: number;
  total: number;
  nextOffset?: number;
}

/** A big group is sent 100 families at a time; the next batch starts once the last one finished. */
/** The students of a group, for choosing who to bill. */
export async function loadGroupMembers(groupId: string): Promise<{ id: string; name: string }[]> {
  const result = await callAsUser<{ members: { id: string; firstName: string; lastName: string }[] }>('academic', `/groups/${encodeURIComponent(groupId)}`);
  return result.ok ? result.data.members.map((member) => ({ id: member.id, name: `${member.firstName} ${member.lastName}` })) : [];
}

export async function createGroupInvoices(_: FormState, data: FormData): Promise<FormState> {
  // Everyone ticked means the whole group; otherwise only the students who were left ticked.
  const chosen = data.get('everyone') === '1' ? [] : data.getAll('studentIds').map(String);
  if (data.get('everyone') !== '1' && chosen.length === 0) return { error: 'Choose at least one student to bill.' };
  const fields = { ...invoiceFields(data), groupId: text(data, 'groupId'), ...(chosen.length > 0 ? { studentIds: chosen } : {}) };
  const sum = { created: 0, skipped: 0, merged: 0 };
  let offset: number | undefined = 0;
  while (offset !== undefined) {
    const result: Awaited<ReturnType<typeof callAsUser<GroupInvoiceBatch>>> = await callAsUser<GroupInvoiceBatch>(
      'billing',
      '/invoices/group',
      { method: 'POST', body: { ...fields, offset } },
    );
    if (!result.ok) {
      refresh();
      const done = sum.created + sum.merged;
      return {
        error:
          errorMessage(result, 'Could not create these invoices') +
          (done > 0 ? ` ${done} families were already billed; run it again to continue.` : ''),
      };
    }
    sum.created += result.data.created;
    sum.skipped += result.data.skipped;
    sum.merged += result.data.merged;
    offset = result.data.nextOffset;
  }
  refresh();
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const parts = [`${plural(sum.created, 'invoice', 'invoices')} sent`];
  if (sum.merged > 0) parts.push(`${plural(sum.merged, 'family', 'families')} added to an invoice they already had`);
  if (sum.skipped > 0) parts.push(`${sum.skipped} skipped (already billed or inactive)`);
  return { success: `${parts.join(', ')}.` };
}

export async function invoiceAction(
  id: string,
  action: 'mark-paid' | 'cancel' | 'receipt/approve',
  _: FormState,
): Promise<FormState> {
  const result = await callAsUser('billing', `/invoices/${id}/${action}`, { method: 'POST' });
  return outcome(result, '', 'That did not work. Please try again.');
}

/** Emails the payer a reminder for an overdue invoice, on top of the automatic ones. */
export async function remindInvoice(id: string, _: FormState): Promise<FormState> {
  const result = await callAsUser('billing', `/invoices/${id}/remind`, { method: 'POST' });
  return outcome(result, 'Reminder sent.', 'Could not send the reminder');
}

export async function rejectReceipt(id: string, _: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('billing', `/invoices/${id}/receipt/reject`, {
    method: 'POST',
    body: { reason: text(data, 'reason') },
  });
  return outcome(result, '', 'Could not reject this receipt');
}

export async function startReceiptUpload(
  invoiceId: string,
  file: { fileName: string; mimeType: string; size: number },
): Promise<{ error?: string; uploadUrl?: string }> {
  const result = await callAsUser<{ uploadUrl: string }>('billing', `/me/invoices/${invoiceId}/receipt`, {
    method: 'POST',
    body: file,
  });
  return result.ok ? { uploadUrl: result.data.uploadUrl } : { error: errorMessage(result, 'Could not start the upload') };
}

export async function finishReceiptUpload(invoiceId: string): Promise<{ error?: string }> {
  const result = await callAsUser('billing', `/me/invoices/${invoiceId}/receipt/complete`, { method: 'POST' });
  if (!result.ok) return { error: errorMessage(result, 'The file could not be verified') };
  refresh();
  return {};
}

export async function savePayment(_: FormState, data: FormData): Promise<FormState> {
  const instructions = text(data, 'instructions');
  const result = await callAsUser('billing', '/settings/payment', {
    method: 'PUT',
    body: {
      accountName: text(data, 'accountName'),
      bankName: text(data, 'bankName'),
      bsb: text(data, 'bsb'),
      accountNumber: text(data, 'accountNumber'),
      currency: text(data, 'currency'),
      ...(instructions ? { instructions } : {}),
    },
  });
  return outcome(result, 'Payment details saved.', 'Could not save payment details');
}

/** One "Title | Detail" per line keeps the form simple for lists on the public site. */
function parseLines<K extends string>(value: string, first: K, second: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [left, ...right] = line.split('|');
      return { [first]: left!.trim(), [second]: right.join('|').trim() || left!.trim() };
    });
}

type Tutor = { name: string; subject: string; bio: string; imageId: string };
type Site = Record<string, unknown> & { tutors: Tutor[]; logoImageId: string };

/** Changes some of the site's settings and keeps the rest, because the service replaces them as a whole. */
async function changeSite(change: (current: Site) => Partial<Site>, success: string): Promise<FormState> {
  const current = await callAsUser<Site>('comms', '/settings/site');
  if (!current.ok) return { error: errorMessage(current, 'Could not load the settings') };
  const { updatedAt: _updatedAt, ...kept } = current.data as Site & { updatedAt?: unknown };
  const result = await callAsUser('comms', '/settings/site', { method: 'PUT', body: { ...kept, ...change(current.data) } });
  return outcome(result, success, 'Could not save these settings');
}

const tutorFrom = (data: FormData): Tutor => ({
  name: text(data, 'name'),
  subject: text(data, 'subject'),
  bio: text(data, 'bio'),
  imageId: text(data, 'imageId'),
});

export async function addTutor(_: FormState, data: FormData): Promise<FormState> {
  return changeSite((site) => ({ tutors: [...site.tutors, tutorFrom(data)] }), 'Tutor added.');
}

export async function updateTutor(index: number, _: FormState, data: FormData): Promise<FormState> {
  return changeSite((site) => ({ tutors: site.tutors.map((tutor, i) => (i === index ? tutorFrom(data) : tutor)) }), 'Saved.');
}

export async function removeTutor(index: number, _: FormState): Promise<FormState> {
  return changeSite((site) => ({ tutors: site.tutors.filter((_tutor, i) => i !== index) }), '');
}

export async function saveSite(_: FormState, data: FormData): Promise<FormState> {
  const current = await callAsUser<Site>('comms', '/settings/site');
  const result = await callAsUser('comms', '/settings/site', {
    method: 'PUT',
    body: {
      logoImageId: text(data, 'logoImageId'),
      tutors: current.ok ? current.data.tutors : [],
      displayName: text(data, 'displayName'),
      primaryColor: text(data, 'primaryColor'),
      timezone: text(data, 'timezone'),
      tagline: text(data, 'tagline'),
      about: text(data, 'about'),
      contactEmail: text(data, 'contactEmail'),
      contactPhone: text(data, 'contactPhone'),
      address: text(data, 'address'),
      openingHours: text(data, 'openingHours'),
      stats: parseLines(text(data, 'stats'), 'value', 'label'),
      highlights: parseLines(text(data, 'highlights'), 'title', 'description'),
      programs: parseLines(text(data, 'programs'), 'title', 'description'),
      faqs: parseLines(text(data, 'faqs'), 'question', 'answer'),
    },
  });
  return outcome(result, 'Saved.', 'Could not save these settings');
}

export async function postAnnouncement(_: FormState, data: FormData): Promise<FormState> {
  const audience = text(data, 'audience');
  const result = await callAsUser('comms', '/announcements', {
    method: 'POST',
    body: {
      title: text(data, 'title'),
      body: text(data, 'body'),
      audience,
      audienceIds: audience === 'tenant' ? [] : data.getAll(`${audience}Ids`).map(String),
      sendEmail: data.get('sendEmail') === 'on',
    },
  });
  return outcome(result, 'Announcement posted.', 'Could not post this announcement');
}

export async function deleteAnnouncement(id: string, _: FormState): Promise<FormState> {
  const result = await callAsUser('comms', `/announcements/${id}`, { method: 'DELETE' });
  return outcome(result, '', 'Could not delete this announcement');
}

export async function setEnquiryStatus(id: string, status: string, _: FormState): Promise<FormState> {
  const result = await callAsUser('comms', `/enquiries/${id}/status`, { method: 'POST', body: { status } });
  return outcome(result, '', 'That did not work. Please try again.');
}

const feedbackBody = (data: FormData) => ({
  studentName: text(data, 'studentName'),
  year: Number(text(data, 'year')),
  quote: text(data, 'quote'),
  published: data.get('published') === 'on',
});

export async function createFeedback(_: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('comms', '/feedback', { method: 'POST', body: feedbackBody(data) });
  return outcome(result, 'Added.', 'Could not add this feedback');
}

export async function setFeedbackPublished(
  item: { id: string; studentName: string; year: number; quote: string; published: boolean },
  _: FormState,
): Promise<FormState> {
  const { id, ...body } = item;
  const result = await callAsUser('comms', `/feedback/${id}`, {
    method: 'PUT',
    body: { ...body, published: !body.published },
  });
  return outcome(result, '', 'That did not work. Please try again.');
}

export async function deleteFeedback(id: string, _: FormState): Promise<FormState> {
  const result = await callAsUser('comms', `/feedback/${id}`, { method: 'DELETE' });
  return outcome(result, '', 'Could not delete this feedback');
}

export async function markNotificationsRead(_: FormState): Promise<FormState> {
  const result = await callAsUser('comms', '/me/notifications/read', { method: 'POST' });
  return outcome(result, '', 'That did not work. Please try again.');
}

export async function submitEnquiry(host: string, _: FormState, data: FormData): Promise<FormState> {
  const { callService } = await import('@/lib/server');
  const { checkCaptcha } = await import('@/lib/captcha');
  const robot = await checkCaptcha(data);
  if (robot) return { error: robot };
  const phone = text(data, 'phone');
  const website = text(data, 'website');
  const result = await callService('comms', '/public/enquiries', {
    method: 'POST',
    body: {
      host,
      name: text(data, 'name'),
      email: text(data, 'email'),
      message: text(data, 'message'),
      ...(phone ? { phone } : {}),
      ...(website ? { website } : {}),
    },
  });
  if (!result.ok) return { error: errorMessage(result, 'Something went wrong. Please try again.') };
  return { success: 'Thank you. We will be in touch soon.' };
}

export async function updatePerson(id: string, _: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('identity', `/users/${id}`, {
    method: 'PATCH',
    body: {
      firstName: text(data, 'firstName'),
      lastName: text(data, 'lastName'),
      phone: text(data, 'phone'),
    },
  });
  return outcome(result, 'Saved.', 'Could not save these details');
}
