import { z } from 'zod';

export const TENANT_STATUSES = ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'FAILED'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

/** Subdomains that must never belong to a tenant. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'cdn',
  'console',
  'dashboard',
  'docs',
  'edura',
  'help',
  'login',
  'mail',
  'platform',
  'smtp',
  'static',
  'status',
  'support',
  'www',
]);

/** A single DNS label, 3 to 63 characters. `xn--` is refused to rule out look-alike domains. */
export const slugSchema = z
  .string()
  .regex(/^(?!xn--)[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, 'Use 3 to 63 lowercase letters, digits or dashes')
  .refine((slug) => !RESERVED_SLUGS.has(slug), 'This address is reserved');

export const tenantIdSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'Invalid tenant id');

const tenantNameSchema =z.string().trim().min(2).max(120);

export const createTenantSchema = z.strictObject({ name: tenantNameSchema, slug: slugSchema });
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const updateTenantSchema = z.strictObject({ name: tenantNameSchema });
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

export const listTenantsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).max(2048).optional(),
});
export type ListTenantsQuery = z.infer<typeof listTenantsQuerySchema>;

export interface TenantDto {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
  failureReason?: string;
}

/** What a request's host points at. Tenants still provisioning or failed resolve to nothing. */
export type HostResolution =
  | { kind: 'platform' }
  | {
      kind: 'tenant';
      tenantId: string;
      slug: string;
      name: string;
      status: Extract<TenantStatus, 'ACTIVE' | 'SUSPENDED'>;
    };

const ledgerDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const createLedgerEntrySchema = z
  .strictObject({
    tenantId: tenantIdSchema,
    description: z.string().trim().max(200).default(''),
    amountCents: z.number().int().positive().max(100_000_000),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code'),
    issueDate: ledgerDate,
    dueDate: ledgerDate,
  })
  .refine((v) => v.dueDate >= v.issueDate, {
    message: 'The due date cannot be before the issue date',
    path: ['dueDate'],
  });
export type CreateLedgerEntryInput = z.infer<typeof createLedgerEntrySchema>;

export const ledgerQuerySchema = z.object({ tenantId: tenantIdSchema.optional() });
export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;

export interface LedgerEntryDto {
  id: string;
  number: string;
  tenantId: string;
  tenantName: string;
  description: string;
  amountCents: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: 'ISSUED' | 'PAID' | 'VOID';
  paidAt?: string;
}

export interface TenantUsageDto {
  tenantId: string;
  name: string;
  slug: string;
  status: TenantStatus;
  activeParents: number;
  activeStudents: number;
}
