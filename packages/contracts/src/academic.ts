import { z } from 'zod';
import { listQuerySchema } from './identity';
import { tenantIdSchema } from './tenants';

const ulid = tenantIdSchema;
const label = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[^#]+$/, 'Invalid text');

export const courseInputSchema = z.strictObject({
  name: label(120),
  description: z.string().trim().max(1000).optional(),
  durationYears: z.number().int().min(1).max(10).optional(),
});
export type CourseInput = z.infer<typeof courseInputSchema>;

/** 99 because one transaction holds 100 writes and the audit entry takes one. */
export const reorderCoursesSchema = z.strictObject({
  ids: z
    .array(ulid)
    .min(1)
    .max(99)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate course'),
});
export type ReorderCoursesInput = z.infer<typeof reorderCoursesSchema>;

/**
 * A course is made of chapters, a chapter of weeks, and each week has a topic. A chapter is marked
 * completed when the teaching for it is done, so parents can see how far the course has got.
 */
export const chapterInputSchema = z.strictObject({ title: label(120) });
export type ChapterInput = z.infer<typeof chapterInputSchema>;

/** Which student groups a chapter is being completed (or reopened) for. */
export const chapterGroupsSchema = z.strictObject({
  groupIds: z
    .array(ulid)
    .min(1, 'Choose at least one group')
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate group'),
});
export type ChapterGroupsInput = z.infer<typeof chapterGroupsSchema>;

export const moveChapterSchema = z.strictObject({ direction: z.enum(['up', 'down']) });
export type MoveChapterInput = z.infer<typeof moveChapterSchema>;

export const weekInputSchema = z.strictObject({
  number: z.number().int().min(1).max(500),
  /** The topic taught that week. */
  title: label(120),
  /** The chapter this week belongs to. Leave out (or null) for a week not in any chapter yet. */
  chapterId: ulid.nullable().optional(),
});
export type WeekInput = z.infer<typeof weekInputSchema>;

/**
 * Decided 2026-11-12 (Q3): any file type and size may be attached. Storage itself stops at 5 TB
 * per file. Files above MULTIPART_THRESHOLD are sent in numbered parts, so size is no real limit.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 ** 4;
export const MULTIPART_THRESHOLD = 100 * 1024 * 1024;
/** Storage allows 10,000 parts of at least 5 MB. Parts grow with the file so any size fits. */
export const MAX_PARTS = 9_000;
export const partSizeFor = (size: number) => Math.max(64 * 1024 * 1024, Math.ceil(size / MAX_PARTS));
export const partCountFor = (size: number) => Math.ceil(size / partSizeFor(size));

/**
 * Only these are shown inside the page. Everything else is served as a download, because a
 * scriptable file (HTML, SVG) opened inline from our storage could run code for the viewer.
 */
export const VIEWABLE_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;
export const isViewable = (mimeType: string) =>
  (VIEWABLE_MIME_TYPES as readonly string[]).includes(mimeType);

export const CONTENT_TYPES = ['video', 'recording', 'notes', 'resource'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const startUploadSchema = z.strictObject({
  type: z.enum(CONTENT_TYPES),
  title: label(160),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z
    .string()
    .max(100)
    .transform((value) => value.trim() || 'application/octet-stream'),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, 'Files up to 5 TB can be uploaded'),
});
export type StartUploadInput = z.infer<typeof startUploadSchema>;

/** The files of one week in the order they should be shown. */
export const reorderItemsSchema = z.strictObject({
  ids: z
    .array(ulid)
    .min(1)
    .max(99)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate file'),
});
export type ReorderItemsInput = z.infer<typeof reorderItemsSchema>;

export const addLinkSchema = z.strictObject({
  type: z.enum(['recording', 'video', 'resource']),
  title: label(160),
  url: z.url({ protocol: /^https?$/ }).max(2000),
  passcode: z.string().max(40).optional(),
});
export type AddLinkInput = z.infer<typeof addLinkSchema>;

export const LINK_MIME_TYPE = 'text/uri-list';

export const updateItemSchema = z
  .strictObject({ title: label(160).optional(), allowDownload: z.boolean().optional(), hidden: z.boolean().optional() })
  .refine((v) => v.title !== undefined || v.allowDownload !== undefined || v.hidden !== undefined, 'Nothing to change');
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');

export const groupInputSchema = z
  .strictObject({
    name: label(120),
    yearLevel: label(30),
    startMonth: monthSchema,
    endMonth: monthSchema,
    courseIds: z
      .array(ulid)
      .max(20)
      .refine((ids) => new Set(ids).size === ids.length, 'Duplicate course'),
  })
  .refine((v) => v.endMonth >= v.startMonth, {
    message: 'The end month cannot be before the start month',
    path: ['endMonth'],
  });
export type GroupInput = z.infer<typeof groupInputSchema>;

/**
 * What a teacher may do inside ONE student group, chosen by the admin when adding them.
 * Seeing the group, its courses, materials and classes is always included (view-only).
 */
export const GROUP_PERMISSIONS = [
  'materials.upload',
  'materials.manage',
  'classes.schedule',
  'recordings.file',
  'students.view',
  'attendance.mark',
] as const;
export type GroupPermission = (typeof GROUP_PERMISSIONS)[number];
export const GROUP_PERMISSION_LABELS: Record<GroupPermission, string> = {
  'materials.upload': 'Upload and add materials',
  'materials.manage': 'Edit and delete materials',
  'classes.schedule': 'Schedule, change and cancel classes',
  'recordings.file': 'File recordings into weeks',
  'students.view': 'See the student list',
  'attendance.mark': 'Mark attendance',
};

export const assignTeacherSchema = z.strictObject({
  permissions: z
    .array(z.enum(GROUP_PERMISSIONS))
    .max(GROUP_PERMISSIONS.length)
    .refine((list) => new Set(list).size === list.length, 'Duplicate permission'),
});
export type AssignTeacherInput = z.infer<typeof assignTeacherSchema>;

export interface GroupTeacherDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  permissions: GroupPermission[];
}

export interface TeachingGroupDto {
  id: string;
  name: string;
  yearLevel: string;
  status: 'ACTIVE' | 'INACTIVE';
  permissions: GroupPermission[];
  courses: { id: string; name: string }[];
}

export const addGroupStudentSchema = z.strictObject({ studentId: ulid });
export type AddGroupStudentInput = z.infer<typeof addGroupStudentSchema>;

export const statusListQuerySchema = listQuerySchema.extend({
  status: z.enum(['active', 'inactive']).default('active'),
});
export type StatusListQuery = z.infer<typeof statusListQuerySchema>;

export const accessQuerySchema = z.object({ download: z.enum(['1']).optional() });
export type AccessQuery = z.infer<typeof accessQuerySchema>;

export interface CourseDto {
  id: string;
  name: string;
  description?: string;
  durationYears?: number;
  status: 'ACTIVE' | 'INACTIVE';
  /** Set when the course has been ended. An ended course is inactive. */
  endedAt?: string;
  /** Set once an ended course's weeks and material have been deleted. Its name and chapters remain. */
  contentDeletedAt?: string;
  createdAt: string;
}

/** Where one student group has got to in a chapter. Groups on the same course move at their own pace. */
export interface ChapterGroupDto {
  id: string;
  name: string;
  completed: boolean;
  completedAt?: string;
}

export interface ChapterDto {
  id: string;
  courseId: string;
  number: number;
  title: string;
  /** Completed only when every group taking the course has completed it. */
  status: 'IN_PROGRESS' | 'COMPLETED';
  completedAt?: string;
  weekCount: number;
  /** The active groups taking this course, each with their own progress. */
  groups: ChapterGroupDto[];
}

export interface WeekDto {
  id: string;
  courseId: string;
  number: number;
  title: string;
  chapterId?: string;
  itemCount: number;
  /** Hidden weeks are only seen by staff. Students and parents do not see them or what is in them. */
  hidden?: boolean;
}

export interface CourseDetailDto extends CourseDto {
  chapters: ChapterDto[];
  weeks: WeekDto[];
}

export interface ContentItemDto {
  id: string;
  weekId: string;
  type: ContentType;
  title: string;
  fileName: string;
  mimeType: string;
  size: number;
  status: 'UPLOADING' | 'READY';
  allowDownload: boolean;
  /** Hidden material is only seen by staff. */
  hidden?: boolean;
  createdAt: string;
}

export interface StartUploadResult {
  itemId: string;
  /** One address for the whole file. Absent for large files, which are sent in parts. */
  uploadUrl?: string;
  multipart?: { partSize: number; parts: number };
}

export const partUrlsSchema = z.strictObject({
  partNumbers: z.array(z.number().int().min(1).max(10_000)).min(1).max(20),
});
export type PartUrlsInput = z.infer<typeof partUrlsSchema>;
export interface PartUrlsDto {
  urls: { partNumber: number; url: string }[];
}

export interface ContentAccessDto {
  url: string;
  title: string;
  mimeType: string;
  canDownload: boolean;
  passcode?: string;
}

/** Ending a group: from this moment its students lose the group's course material and classes. */
export const endGroupSchema = z.strictObject({ endsAt: z.string().datetime() });
export type EndGroupInput = z.infer<typeof endGroupSchema>;

export interface GroupDto {
  id: string;
  name: string;
  yearLevel: string;
  startMonth: string;
  endMonth: string;
  status: 'ACTIVE' | 'INACTIVE';
  /** When the group's students lose access to its materials. In the future it is a scheduled ending. */
  accessEndsAt?: string;
  memberCount: number;
  createdAt: string;
}

export interface GroupMemberDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface GroupDetailDto extends GroupDto {
  courses: { id: string; name: string }[];
  /** A teacher without "see the student list" gets an empty list and `membersHidden`. */
  members: GroupMemberDto[];
  membersHidden?: boolean;
  teachers: GroupTeacherDto[];
}

export const watchProgressSchema = z.strictObject({
  positionSeconds: z.number().min(0).max(86_400),
  durationSeconds: z.number().positive().max(86_400),
});
export type WatchProgressInput = z.infer<typeof watchProgressSchema>;

export interface ContinueWatchingDto {
  courseId: string;
  courseName: string;
  weekId: string;
  weekNumber: number;
  itemId: string;
  title: string;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: string;
}

/** What a student or parent sees of a chapter: its place in the course and whether it has been taught. */
export interface LearnerChapterDto {
  id: string;
  number: number;
  title: string;
  completed: boolean;
  completedAt?: string;
}

export interface LearnerCourseDto {
  id: string;
  name: string;
  description?: string;
  durationYears?: number;
  /** How far the course has got, when it has chapters. */
  progress?: { chaptersDone: number; chaptersTotal: number };
  /** The chapters in order, so a parent can see which have been taught. Present only when there are some. */
  chapters?: LearnerChapterDto[];
}

export interface LearnerSummaryDto {
  courses: LearnerCourseDto[];
  groups: { id: string; name: string; yearLevel: string }[];
  /** Courses whose group has ended: the name and results stay, the material does not. */
  endedCourses?: { id: string; name: string; endedAt: string }[];
  endedGroups?: { id: string; name: string; yearLevel: string; endedAt: string }[];
}

export interface LearnerWeekDto {
  id: string;
  number: number;
  title: string;
  chapterId?: string;
  items: ContentItemDto[];
}

export interface LearnerCourseDetailDto extends LearnerCourseDto {
  chapters: LearnerChapterDto[];
  weeks: LearnerWeekDto[];
}
