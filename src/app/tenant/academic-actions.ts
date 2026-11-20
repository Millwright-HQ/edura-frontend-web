'use server';

import type { StartUploadResult } from '@edura/contracts';
import { revalidatePath } from 'next/cache';
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

function courseBody(data: FormData) {
  const description = text(data, 'description');
  const years = text(data, 'durationYears');
  return {
    name: text(data, 'name'),
    ...(description ? { description } : {}),
    ...(years ? { durationYears: Number(years) } : {}),
  };
}

export async function createCourse(_: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('academic', '/courses', { method: 'POST', body: courseBody(data) });
  return outcome(result, 'Course created.', 'Could not create the course');
}

export async function updateCourse(id: string, _: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('academic', `/courses/${id}`, { method: 'PUT', body: courseBody(data) });
  return outcome(result, 'Saved.', 'Could not save the course');
}

export async function setCourseActive(id: string, active: boolean, _: FormState): Promise<FormState> {
  const verb = active ? 'reactivate' : 'deactivate';
  const result = await callAsUser('academic', `/courses/${id}/${verb}`, { method: 'POST' });
  return outcome(result, '', 'That did not work. Please try again.');
}

export async function reorderCourses(ids: string[], _: FormState): Promise<FormState> {
  const result = await callAsUser('academic', '/courses/reorder', { method: 'POST', body: { ids } });
  return outcome(result, '', 'Could not move this course');
}

const weekBody = (data: FormData) => ({
  number: Number(text(data, 'number')),
  title: text(data, 'title'),
  // An empty choice means "no chapter": taken out of one when editing, left out when adding.
  chapterId: text(data, 'chapterId') || null,
});

export async function addChapter(courseId: string, _: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('academic', `/courses/${courseId}/chapters`, { method: 'POST', body: { title: text(data, 'title') } });
  return outcome(result, 'Chapter added.', 'Could not add the chapter');
}

export async function renameChapter(courseId: string, chapterId: string, _: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('academic', `/courses/${courseId}/chapters/${chapterId}`, { method: 'PUT', body: { title: text(data, 'title') } });
  return outcome(result, 'Saved.', 'Could not rename the chapter');
}

export async function moveChapter(courseId: string, chapterId: string, direction: 'up' | 'down', _: FormState): Promise<FormState> {
  const result = await callAsUser('academic', `/courses/${courseId}/chapters/${chapterId}/move`, { method: 'POST', body: { direction } });
  return outcome(result, '', 'Could not move this chapter');
}

/**
 * Marking a chapter completed is what the chosen groups' students and parents see; it can be undone.
 * Other groups taking the same course are left as they are.
 */
export async function setChapterDone(courseId: string, chapterId: string, done: boolean, _: FormState, data: FormData): Promise<FormState> {
  const groupIds = data.getAll('groupIds').map(String);
  if (groupIds.length === 0) return { error: 'Choose at least one group.' };
  const result = await callAsUser('academic', `/courses/${courseId}/chapters/${chapterId}/${done ? 'complete' : 'reopen'}`, { method: 'POST', body: { groupIds } });
  return outcome(result, done ? 'Chapter marked as completed.' : 'Chapter reopened.', 'Could not change this chapter');
}

export async function deleteChapter(courseId: string, chapterId: string, _: FormState): Promise<FormState> {
  const result = await callAsUser('academic', `/courses/${courseId}/chapters/${chapterId}`, { method: 'DELETE' });
  return outcome(result, '', 'Could not delete the chapter');
}

export async function assignTeacher(groupId: string, userId: string, _: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('academic', `/groups/${groupId}/teachers/${userId}`, {
    method: 'PUT',
    body: { permissions: data.getAll('permissions').map(String) },
  });
  return outcome(result, 'Saved.', 'Could not save this teacher');
}

export async function addTeacherToGroup(groupId: string, _: FormState, data: FormData): Promise<FormState> {
  const userId = text(data, 'userId');
  const result = await callAsUser('academic', `/groups/${groupId}/teachers/${userId}`, {
    method: 'PUT',
    body: { permissions: data.getAll('permissions').map(String) },
  });
  return outcome(result, 'Teacher added.', 'Could not add this teacher');
}

export async function removeTeacher(groupId: string, userId: string, _: FormState): Promise<FormState> {
  const result = await callAsUser('academic', `/groups/${groupId}/teachers/${userId}`, { method: 'DELETE' });
  return outcome(result, '', 'Could not remove this teacher');
}

export async function reorderItems(courseId: string, weekId: string, ids: string[], _: FormState): Promise<FormState> {
  const result = await callAsUser('academic', `/courses/${courseId}/weeks/${weekId}/reorder`, {
    method: 'POST',
    body: { ids },
  });
  return outcome(result, '', 'Could not move this file');
}

export async function partUrls(
  courseId: string,
  weekId: string,
  itemId: string,
  partNumbers: number[],
): Promise<{ urls?: { partNumber: number; url: string }[]; error?: string }> {
  const result = await callAsUser<{ urls: { partNumber: number; url: string }[] }>(
    'academic',
    `/courses/${courseId}/weeks/${weekId}/items/${itemId}/parts`,
    { method: 'POST', body: { partNumbers } },
  );
  return result.ok ? { urls: result.data.urls } : { error: errorMessage(result, 'Could not continue the upload') };
}

export async function addWeek(courseId: string, _: FormState, data: FormData): Promise<FormState> {
  const { chapterId, ...rest } = weekBody(data);
  const result = await callAsUser('academic', `/courses/${courseId}/weeks`, {
    method: 'POST',
    body: { ...rest, ...(chapterId ? { chapterId } : {}) },
  });
  return outcome(result, 'Week added.', 'Could not add the week');
}

export async function updateWeek(
  courseId: string,
  weekId: string,
  _: FormState,
  data: FormData,
): Promise<FormState> {
  const result = await callAsUser('academic', `/courses/${courseId}/weeks/${weekId}`, {
    method: 'PUT',
    body: weekBody(data),
  });
  return outcome(result, 'Saved.', 'Could not save the week');
}

export async function deleteWeek(courseId: string, weekId: string, _: FormState): Promise<FormState> {
  const result = await callAsUser('academic', `/courses/${courseId}/weeks/${weekId}`, { method: 'DELETE' });
  return outcome(result, 'Week deleted.', 'Could not delete the week');
}

export interface UploadRequest {
  type: string;
  title: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export async function startUpload(
  courseId: string,
  weekId: string,
  request: UploadRequest,
): Promise<{ error?: string; upload?: StartUploadResult }> {
  const result = await callAsUser<StartUploadResult>(
    'academic',
    `/courses/${courseId}/weeks/${weekId}/items`,
    { method: 'POST', body: request },
  );
  if (!result.ok) return { error: errorMessage(result, 'Could not start the upload') };
  return { upload: result.data };
}

export async function finishUpload(
  courseId: string,
  weekId: string,
  itemId: string,
): Promise<{ error?: string }> {
  const result = await callAsUser('academic', `/courses/${courseId}/weeks/${weekId}/items/${itemId}/complete`, {
    method: 'POST',
  });
  if (!result.ok) return { error: errorMessage(result, 'The file could not be verified') };
  refresh();
  return {};
}

/** Called every few seconds while a student watches, so it must not refresh the page. */
export async function saveProgress(
  courseId: string,
  weekId: string,
  itemId: string,
  positionSeconds: number,
  durationSeconds: number,
): Promise<void> {
  await callAsUser('academic', `/me/courses/${courseId}/weeks/${weekId}/items/${itemId}/progress`, {
    method: 'PUT',
    body: { positionSeconds, durationSeconds },
  });
}

export async function setItemDownload(
  courseId: string,
  weekId: string,
  itemId: string,
  allowDownload: boolean,
  _: FormState,
): Promise<FormState> {
  const result = await callAsUser('academic', `/courses/${courseId}/weeks/${weekId}/items/${itemId}`, {
    method: 'PATCH',
    body: { allowDownload },
  });
  return outcome(result, '', 'That did not work. Please try again.');
}

export async function setItemHidden(
  courseId: string,
  weekId: string,
  itemId: string,
  hidden: boolean,
  _: FormState,
): Promise<FormState> {
  const result = await callAsUser('academic', `/courses/${courseId}/weeks/${weekId}/items/${itemId}`, {
    method: 'PATCH',
    body: { hidden },
  });
  return outcome(result, '', 'That did not work. Please try again.');
}

export async function setWeekHidden(courseId: string, weekId: string, hidden: boolean, _: FormState): Promise<FormState> {
  const result = await callAsUser('academic', `/courses/${courseId}/weeks/${weekId}/${hidden ? 'hide' : 'show'}`, { method: 'POST' });
  return outcome(result, '', 'That did not work. Please try again.');
}

export async function deleteItem(
  courseId: string,
  weekId: string,
  itemId: string,
  _: FormState,
): Promise<FormState> {
  const result = await callAsUser('academic', `/courses/${courseId}/weeks/${weekId}/items/${itemId}`, {
    method: 'DELETE',
  });
  return outcome(result, '', 'Could not delete this file');
}

const groupBody = (data: FormData) => ({
  name: text(data, 'name'),
  yearLevel: text(data, 'yearLevel'),
  startMonth: text(data, 'startMonth'),
  endMonth: text(data, 'endMonth'),
  courseIds: data.getAll('courseIds').map(String),
});

export async function createGroup(_: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('academic', '/groups', { method: 'POST', body: groupBody(data) });
  return outcome(result, 'Group created.', 'Could not create the group');
}

export async function updateGroup(id: string, _: FormState, data: FormData): Promise<FormState> {
  const result = await callAsUser('academic', `/groups/${id}`, { method: 'PUT', body: groupBody(data) });
  return outcome(result, 'Saved.', 'Could not save the group');
}

export async function setGroupActive(id: string, active: boolean, _: FormState): Promise<FormState> {
  const verb = active ? 'reactivate' : 'archive';
  const result = await callAsUser('academic', `/groups/${id}/${verb}`, { method: 'POST' });
  return outcome(result, '', 'That did not work. Please try again.');
}

/**
 * Ends a group on a date: its students lose the group's materials and classes from that moment, its later classes
 * come off the calendar, and the announcement (written in the same form) goes to the group and its families.
 */
export async function endGroup(groupId: string, groupName: string, courseNames: string[], _: FormState, data: FormData): Promise<FormState> {
  const day = text(data, 'endDate');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: 'Choose the date the group ends.' };
  const timezone = await getTimezone();
  const endsAt = zonedToUtc(`${day}T00:00`, timezone);
  const ended = await callAsUser('academic', `/groups/${groupId}/end`, { method: 'POST', body: { endsAt } });
  if (!ended.ok) return { error: errorMessage(ended, 'Could not end this group') };

  const classes = await callAsUser('classes', `/groups/${groupId}/end-classes`, { method: 'POST', body: { from: endsAt } });
  let problem = classes.ok ? '' : `Classes could not be removed from the calendar: ${errorMessage(classes, 'unknown error')}. `;

  if (data.get('notify') === 'on') {
    const nice = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(endsAt));
    const body = [
      text(data, 'message'),
      `Access to this group’s course materials and classes ends on ${nice}.`,
      courseNames.length > 0 ? `Courses affected: ${courseNames.join(', ')}.` : '',
      'You can still sign in after that date to see your results and, for parents, invoices.',
    ]
      .filter(Boolean)
      .join('\n\n');
    const posted = await callAsUser('comms', '/announcements', {
      method: 'POST',
      body: { title: text(data, 'subject') || `${groupName} is ending`, body, audience: 'group', audienceIds: [groupId], sendEmail: true },
    });
    if (!posted.ok) problem += `The announcement was not sent: ${errorMessage(posted, 'unknown error')}.`;
  }
  refresh();
  return problem ? { error: `The group now ends on that date. ${problem}` } : { success: '' };
}

export async function cancelGroupEnd(groupId: string, _: FormState): Promise<FormState> {
  const result = await callAsUser('academic', `/groups/${groupId}/end/cancel`, { method: 'POST' });
  return outcome(result, '', 'That did not work. Please try again.');
}

export async function endCourse(courseId: string, _: FormState): Promise<FormState> {
  const result = await callAsUser('academic', `/courses/${courseId}/end`, { method: 'POST' });
  return outcome(result, '', 'Could not end this course');
}

export async function deleteCourseContent(courseId: string, _: FormState): Promise<FormState> {
  const result = await callAsUser('academic', `/courses/${courseId}/delete-content`, { method: 'POST' });
  return outcome(result, '', 'Could not delete this course’s content');
}

export async function addGroupStudent(groupId: string, studentId: string, _: FormState): Promise<FormState> {
  const result = await callAsUser('academic', `/groups/${groupId}/students`, {
    method: 'POST',
    body: { studentId },
  });
  return outcome(result, '', 'Could not add this student');
}

/** Adds every ticked student. Each one goes through the same checked route, so each is permission-checked and recorded. */
export async function addGroupStudents(groupId: string, _: FormState, data: FormData): Promise<FormState> {
  const ids = data.getAll('studentId').map(String).filter(Boolean);
  if (ids.length === 0) return { error: 'Tick at least one student.' };
  let added = 0;
  for (const studentId of ids) {
    const result = await callAsUser('academic', `/groups/${groupId}/students`, { method: 'POST', body: { studentId } });
    if (!result.ok) {
      if (added > 0) refresh();
      return { error: `${added} added. ${errorMessage(result, 'Could not add the rest')}` };
    }
    added++;
  }
  refresh();
  return { success: '' };
}

export async function removeGroupStudent(groupId: string, studentId: string, _: FormState): Promise<FormState> {
  const result = await callAsUser('academic', `/groups/${groupId}/students/${studentId}`, {
    method: 'DELETE',
  });
  return outcome(result, '', 'Could not remove this student');
}
