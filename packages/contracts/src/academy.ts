import { z } from 'zod';
import { emailSchema, personNameSchema } from './identity';
import { slugSchema } from './tenants';

/** Someone asking for their academy to be set up. A platform staff member approves it. */
export const academyRequestSchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema,
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: emailSchema,
  /** Hidden from people. Only automated form-fillers complete it. */
  website: z.string().max(200).optional(),
});
export type AcademyRequestInput = z.infer<typeof academyRequestSchema>;

export const ACADEMY_REQUEST_STATUSES = ['pending', 'approved', 'declined'] as const;
export type AcademyRequestStatus = (typeof ACADEMY_REQUEST_STATUSES)[number];

export const listAcademyRequestsSchema = z.object({
  status: z.enum(ACADEMY_REQUEST_STATUSES).default('pending'),
});
export type ListAcademyRequestsQuery = z.infer<typeof listAcademyRequestsSchema>;

export const closeAcademyRequestSchema = z.strictObject({ status: z.enum(['approved', 'declined']) });
export type CloseAcademyRequestInput = z.infer<typeof closeAcademyRequestSchema>;

export interface AcademyRequestDto {
  id: string;
  name: string;
  slug: string;
  firstName: string;
  lastName: string;
  email: string;
  status: AcademyRequestStatus;
  createdAt: string;
}
