import { z } from 'zod';
import { emailSchema, listQuerySchema, passwordSchema, personNameSchema } from './identity';
import { tenantIdSchema } from './tenants';

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{6,20}$/, 'Enter a valid phone number');

export const parentInputSchema = z.strictObject({
  email: emailSchema,
  firstName: personNameSchema,
  lastName: personNameSchema,
  phone: phoneSchema.optional(),
});
export type ParentInput = z.infer<typeof parentInputSchema>;

export const studentInputSchema = z.strictObject({
  email: emailSchema,
  firstName: personNameSchema,
  lastName: personNameSchema,
  phone: phoneSchema.optional(),
});
export type StudentInput = z.infer<typeof studentInputSchema>;

/** Set by an admin. Without a password the person is emailed a link to choose their own. */
export const adminParentInputSchema = parentInputSchema.extend({ password: passwordSchema.optional() });
export type AdminParentInput = z.infer<typeof adminParentInputSchema>;

export const adminStudentInputSchema = studentInputSchema.extend({ password: passwordSchema.optional() });
export type AdminStudentInput = z.infer<typeof adminStudentInputSchema>;

/** A student needs only their own login; a parent can be linked now or later. */
export const createStudentSchema = studentInputSchema.extend({
  password: passwordSchema,
  parentId: tenantIdSchema.optional(),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const setUserPasswordSchema = z.strictObject({ password: passwordSchema });
export type SetUserPasswordInput = z.infer<typeof setUserPasswordSchema>;

/** Email is the login, so nobody in one family submission can share one. */
function requireDistinctEmails(
  value: { parent?: { email: string } | undefined; students: { email: string }[] },
  context: z.RefinementCtx,
) {
  const emails = [...(value.parent ? [value.parent.email] : []), ...value.students.map((s) => s.email)];
  if (new Set(emails).size !== emails.length) {
    context.addIssue({
      code: 'custom',
      message: 'Each parent and student needs their own email address',
      path: ['students'],
    });
  }
}

export const createParentSchema = z
  .strictObject({
    parent: adminParentInputSchema,
    students: z.array(adminStudentInputSchema).max(10).default([]),
    /** Students who already have a login, linked to this new parent. */
    studentIds: z.array(tenantIdSchema).max(20).default([]),
  })
  .superRefine(requireDistinctEmails);
export type CreateParentInput = z.infer<typeof createParentSchema>;

export const enrolmentRequestSchema = z
  .strictObject({
    host: z.string().min(1).max(300),
    /** Hidden from people. Only automated form-fillers complete it. */
    website: z.string().max(200).optional(),
    parent: parentInputSchema.optional(),
    students: z.array(studentInputSchema).min(1).max(10),
    message: z.string().trim().max(1000).optional(),
  })
  .superRefine(requireDistinctEmails);
export type EnrolmentRequestInput = z.infer<typeof enrolmentRequestSchema>;

export const rejectRequestSchema = z.strictObject({
  reason: z.string().trim().max(300).optional(),
});
export type RejectRequestInput = z.infer<typeof rejectRequestSchema>;

export const listUsersQuerySchema = listQuerySchema.extend({
  kind: z.enum(['parent', 'student']),
  status: z.enum(['active', 'inactive']).default('active'),
  /** Start of the surname. */
  search: z
    .string()
    .trim()
    .toLowerCase()
    .max(60)
    .regex(/^[^#]*$/)
    .optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const updatePersonSchema = z.strictObject({
  firstName: personNameSchema,
  lastName: personNameSchema,
  phone: z.union([phoneSchema, z.literal('')]).optional(),
});
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

export const REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const listRequestsQuerySchema = listQuerySchema.extend({
  status: z.enum(REQUEST_STATUSES).default('pending'),
});
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;

export interface PersonDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  kind: string;
  status: 'ACTIVE' | 'INACTIVE';
  phone?: string;
  createdAt: string;
}

export interface UserDetailDto extends PersonDto {
  children?: PersonDto[];
  parents?: PersonDto[];
}

/** Who an invoice can be addressed to: a parent, or a student who has no parent. */
export interface BillableFamilyDto {
  billToId: string;
  name: string;
  studentIds: string[];
  studentNames: string[];
}

export const DEMO_PROFILES = ['admin', 'parent', 'student'] as const;
export type DemoProfile = (typeof DEMO_PROFILES)[number];

export const demoSessionSchema = z.strictObject({
  host: z.string().min(1).max(300),
  profile: z.enum(DEMO_PROFILES),
});
export type DemoSessionInput = z.infer<typeof demoSessionSchema>;

export interface DemoProfileDto {
  profile: DemoProfile;
  firstName: string;
  lastName: string;
}

export interface UserStatsDto {
  activeParents: number;
  activeStudents: number;
  inactiveParents: number;
  inactiveStudents: number;
  pendingRequests: number;
}

/** What approving returns: the request, and the students it created so they can be added to a group. */
export interface ApprovedRequestDto extends EnrolmentRequestDto {
  studentIds: string[];
}

export interface EnrolmentRequestDto {
  id: string;
  status: RequestStatus;
  parent?: ParentInput;
  students: StudentInput[];
  message?: string;
  rejectionReason?: string;
  createdAt: string;
  decidedAt?: string;
}
