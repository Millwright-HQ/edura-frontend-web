import { z } from 'zod';

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');

/** Filters for the audit pages. The log is read one month at a time. */
export const auditQuerySchema = z.object({
  month: month.optional(),
  tenantId: z.string().trim().min(1).max(40).optional(),
  /** Matches the start of an action, such as `invoice` or `user.student`. */
  action: z.string().trim().min(1).max(60).optional(),
  actorId: z.string().trim().min(1).max(80).optional(),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export interface AuditEntryDto {
  id: string;
  at: string;
  action: string;
  actorId: string;
  actorName: string;
  /** Who did it: Edura staff, or a person inside the academy. */
  actorKind: 'platform' | 'tenant' | 'unknown';
  tenantId?: string;
  tenantName?: string;
  targetId: string;
  /** What changed, in words, when we can tell (a person's name, an invoice number). */
  targetName?: string;
  detail?: Record<string, unknown>;
}

export interface AuditPageDto {
  month: string;
  /** Months that have entries, newest first, so the page can offer them. */
  months: string[];
  entries: AuditEntryDto[];
  /** True when the month had more entries than we return. */
  truncated: boolean;
}

/** Everything the owner sees about one academy. */
export interface TenantOverviewDto {
  people: {
    activeStudents: number;
    activeParents: number;
    inactiveStudents: number;
    inactiveParents: number;
    pendingRequests: number;
  };
  billing: {
    openCount: number;
    overdueCount: number;
    paidCount: number;
    /** What the academy owes Edura right now, per currency, in cents. */
    owing: { currency: string; cents: number }[];
  };
  lastActivityAt?: string;
  recent: AuditEntryDto[];
}
