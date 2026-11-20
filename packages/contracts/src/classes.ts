import { z } from 'zod';
import { tenantIdSchema } from './tenants';

const ulid = tenantIdSchema;
const isoInstant = z.string().datetime({ offset: true });
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');

const sessionFields = {
  /** Which connected Zoom account hosts the class. Optional only while one account is connected. */
  zoomAccountId: z.string().trim().min(1).max(100).optional(),
  topic: z.string().trim().min(1).max(160).regex(/^[^#]+$/, 'Invalid text'),
  startsAt: isoInstant,
  durationMinutes: z.number().int().min(15).max(480),
  groupIds: z.array(ulid).min(1, 'Choose at least one group').max(20),
  /** The course week this class teaches. When set, its Zoom recording is filed into that week by itself. */
  week: z.strictObject({ courseId: ulid, weekId: ulid }).optional(),
  /** Email the students and their parents the class and its Zoom links. On unless turned off. */
  sendEmail: z.boolean().default(true),
};

/** Weekly classes become separate sessions, so one week can be moved or cancelled on its own. */
export const createSessionSchema = z.strictObject({
  ...sessionFields,
  weeks: z.number().int().min(1).max(52).default(1),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const updateSessionSchema = z.strictObject(sessionFields);
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

/** The person's own Zoom app (Zoom Marketplace, a General or OAuth app). Stored encrypted; never returned. */
export const connectZoomSchema = z.strictObject({
  clientId: z.string().trim().min(5).max(200),
  clientSecret: z.string().trim().min(5).max(200),
  /** The app's Secret Token (Feature, Event Subscriptions). Needed for attendance and recordings. */
  webhookSecret: z.string().trim().max(200).optional(),
});
export type ConnectZoomInput = z.infer<typeof connectZoomSchema>;

/** Ending a group: its classes from this moment on are taken off the calendar. */
export const endGroupClassesSchema = z.strictObject({ from: z.string().datetime() });
export type EndGroupClassesInput = z.infer<typeof endGroupClassesSchema>;

export const zoomCallbackSchema = z.strictObject({
  code: z.string().min(1).max(2000),
  state: z.string().min(1).max(1000),
});
export type ZoomCallbackInput = z.infer<typeof zoomCallbackSchema>;

export const monthQuerySchema = z.object({ month: monthSchema });
export type MonthQuery = z.infer<typeof monthQuerySchema>;

export const fileRecordingSchema = z.strictObject({
  courseId: ulid,
  weekId: ulid,
  title: z.string().trim().min(1).max(160).regex(/^[^#]+$/, 'Invalid text'),
});
export type FileRecordingInput = z.infer<typeof fileRecordingSchema>;

export const disconnectZoomSchema = z.strictObject({
  accountId: z.string().trim().min(1).max(100).optional(),
});
export type DisconnectZoomInput = z.infer<typeof disconnectZoomSchema>;

/** Sent by the classes service to the zoom service. Never by a browser. */
export const meetingInputSchema = z.strictObject({
  sessionId: ulid,
  zoomAccountId: z.string().trim().min(1).max(100).optional(),
  topic: z.string().trim().min(1).max(160),
  startsAt: isoInstant,
  durationMinutes: z.number().int().min(15).max(480),
});
export type MeetingInput = z.infer<typeof meetingInputSchema>;

export const meetingChangeSchema = z.strictObject({
  topic: z.string().trim().min(1).max(160),
  startsAt: isoInstant,
  durationMinutes: z.number().int().min(15).max(480),
});
export type MeetingChange = z.infer<typeof meetingChangeSchema>;

/** A free Zoom account cuts a meeting off after this long, so a longer class is made of several meetings. */
export const FREE_MEETING_MINUTES = 40;

export type ZoomPlan = 'free' | 'pro';

/** One Zoom meeting. A class is one segment, or several in a row when the account is free. */
export interface MeetingSegmentDto {
  meetingId: string;
  joinUrl: string;
  startsAt: string;
  durationMinutes: number;
}

/**
 * How long each meeting of a class runs. A pro account takes any length in one meeting; a free account
 * is cut into back-to-back meetings of at most 40 minutes (two hours becomes three).
 */
export function splitClass(startsAt: string, totalMinutes: number, plan: ZoomPlan): { startsAt: string; durationMinutes: number }[] {
  if (plan === 'pro' || totalMinutes <= FREE_MEETING_MINUTES) return [{ startsAt, durationMinutes: totalMinutes }];
  const parts: { startsAt: string; durationMinutes: number }[] = [];
  const first = new Date(startsAt).getTime();
  for (let done = 0; done < totalMinutes; done += FREE_MEETING_MINUTES) {
    parts.push({
      startsAt: new Date(first + done * 60_000).toISOString(),
      durationMinutes: Math.min(FREE_MEETING_MINUTES, totalMinutes - done),
    });
  }
  return parts;
}

/** What the browser needs to put a Zoom meeting inside an Edura page. Only a signed, short-lived token; never the app secret. */
export interface SdkJoinDto {
  sdkKey: string;
  signature: string;
  meetingNumber: string;
  password: string;
  role: 'host' | 'attendee';
  /** Only for the host: lets them start the meeting as the Zoom account that owns it. */
  zak?: string;
}

export interface MeetingCreatedDto {
  /** The first meeting, kept for older screens. */
  meetingId: string;
  joinUrl: string;
  zoomAccountId: string;
  plan: ZoomPlan;
  segments: MeetingSegmentDto[];
}

export const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const markAttendanceSchema = z.strictObject({
  entries: z
    .array(z.strictObject({ studentId: ulid, status: z.enum(ATTENDANCE_STATUSES) }))
    .min(1)
    .max(90)
    .refine((list) => new Set(list.map((e) => e.studentId)).size === list.length, 'A student appears twice'),
});
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
export type AttendanceEntry = MarkAttendanceInput['entries'][number];

export interface AttendanceSheetDto {
  sessionId: string;
  topic: string;
  startsAt: string;
  rows: {
    studentId: string;
    firstName: string;
    lastName: string;
    status?: AttendanceStatus;
    /** `zoom` when Zoom's record made the mark and nobody has changed it. */
    source?: 'zoom';
    /** Minutes the student was on Zoom during the class, when Zoom has reported anyone. */
    zoomMinutes?: number;
  }[];
  zoom?: {
    classMinutes: number;
    /** People Zoom saw who could not be matched to a student, to be marked by hand. */
    unmatched: { name: string; minutes: number }[];
  };
}

export interface StudentAttendanceDto {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  recent: { sessionId: string; topic: string; startsAt: string; status: AttendanceStatus }[];
}

export interface ZoomAccountDto {
  accountId: string;
  displayName: string;
  connectedAt: string;
  /** Free accounts cap each meeting at 40 minutes. Read from Zoom when the account is connected. */
  plan: ZoomPlan;
  /** Identifies this connection's own webhook address. */
  appId: string;
  /** Who connected it (their sign-in email). */
  ownerEmail: string;
  /** Whether a webhook secret was saved, so attendance and recordings can arrive. */
  hasWebhookSecret: boolean;
}

/** An academy can connect several Zoom accounts, for example one per teacher. */
export interface ZoomConnectionDto {
  connected: boolean;
  /** The first account's name, kept for older screens. */
  displayName?: string;
  accounts: ZoomAccountDto[];
  /** What the person must register in their Zoom app. */
  redirectUri: string;
  /** Webhook address is `${webhookBase}/webhooks/zoom/<appId>`; empty when the platform has no public address set. */
  webhookBase: string;
}

/**
 * `held` and `missed` describe a class that is over: `held` once someone started it, `missed` when no
 * one ever did. A missed class can be moved to a new time; a held one is history.
 */
export type SessionStatus = 'upcoming' | 'live' | 'held' | 'missed';

export interface SessionPartDto {
  part: number;
  startsAt: string;
  durationMinutes: number;
}

export interface SessionDto {
  id: string;
  seriesId?: string;
  topic: string;
  startsAt: string;
  durationMinutes: number;
  live: boolean;
  status: SessionStatus;
  zoomAccountId?: string;
  /** One entry per Zoom meeting. More than one when a free account cut a long class up. */
  parts: SessionPartDto[];
  /** The course week the class belongs to, if one was chosen. */
  week?: { courseId: string; weekId: string };
  groups: { id: string; name: string }[];
}

export interface LearnerSessionDto {
  id: string;
  topic: string;
  startsAt: string;
  durationMinutes: number;
  canJoin: boolean;
  /** The host has started it: students can go straight in. */
  live?: boolean;
  /** Present only when the class is made of several meetings: join the one being taught. */
  parts?: SessionPartDto[];
}

export interface LearnerScheduleDto {
  upcoming: LearnerSessionDto[];
  past: LearnerSessionDto[];
}

export interface RecordingDto {
  id: string;
  sessionId?: string;
  topic: string;
  startedAt: string;
  durationMinutes: number;
  sizeBytes: number;
  filed?: { courseId: string; weekId: string; itemId: string };
}
