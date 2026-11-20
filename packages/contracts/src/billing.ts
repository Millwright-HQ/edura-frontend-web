import { z } from 'zod';
import { tenantIdSchema } from './tenants';

const ulid = tenantIdSchema;
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');
const text = (max: number) => z.string().trim().min(1).max(max);

const invoiceFields = {
  description: text(200),
  amountCents: z.number().int().positive().max(100_000_000),
  issueDate: dateSchema,
  dueDate: dateSchema,
  periodMonth: monthSchema,
};
const dueAfterIssue = (value: { issueDate: string; dueDate: string }) =>
  value.dueDate >= value.issueDate;
const dueMessage = { message: 'The due date cannot be before the issue date', path: ['dueDate'] };

export const createInvoiceSchema = z
  .strictObject({
    ...invoiceFields,
    parentId: ulid,
    studentIds: z
      .array(ulid)
      .min(1)
      .max(10)
      .refine((ids) => new Set(ids).size === ids.length, 'Duplicate student'),
  })
  .refine(dueAfterIssue, dueMessage);
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

/** One request handles at most this many families (a transaction holds 100 writes). */
export const GROUP_INVOICE_BATCH = 100;

/**
 * `amountCents` is per student; each family gets one invoice covering its children. A large group
 * is sent in batches: call again with `nextOffset` from the previous answer until it is absent.
 */
export const createGroupInvoicesSchema = z
  .strictObject({
    ...invoiceFields,
    groupId: ulid,
    /** Bill only these students of the group. Leave out to bill everyone in it. */
    studentIds: z.array(ulid).min(1).max(500).optional(),
    offset: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(GROUP_INVOICE_BATCH).default(GROUP_INVOICE_BATCH),
  })
  .refine(dueAfterIssue, dueMessage);
export type CreateGroupInvoicesInput = z.input<typeof createGroupInvoicesSchema>;

export const INVOICE_STATUSES = ['PENDING', 'OVERDUE', 'PAID', 'CANCELLED'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const listInvoicesQuerySchema = z.object({
  month: monthSchema,
  status: z.enum(INVOICE_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
});
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;

export const parentInvoicesQuerySchema = z.object({
  status: z.enum(INVOICE_STATUSES).optional(),
  month: monthSchema.optional(),
  studentId: ulid.optional(),
});
export type ParentInvoicesQuery = z.infer<typeof parentInvoicesQuerySchema>;

export const statsQuerySchema = z.object({ month: monthSchema });
export type StatsQuery = z.infer<typeof statsQuerySchema>;

export const RECEIPT_RULES = {
  mimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
  maxBytes: 10 * 1024 * 1024,
} as const;

export const startReceiptSchema = z
  .strictObject({
    fileName: text(200),
    mimeType: z.string().max(100),
    size: z.number().int().positive(),
  })
  .superRefine((value, context) => {
    if (!(RECEIPT_RULES.mimeTypes as readonly string[]).includes(value.mimeType)) {
      context.addIssue({ code: 'custom', message: 'Use a PDF, PNG or JPEG file', path: ['mimeType'] });
    }
    if (value.size > RECEIPT_RULES.maxBytes) {
      context.addIssue({ code: 'custom', message: 'The limit for a receipt is 10 MB', path: ['size'] });
    }
  });
export type StartReceiptInput = z.infer<typeof startReceiptSchema>;

export const rejectReceiptSchema = z.strictObject({ reason: text(300) });
export type RejectReceiptInput = z.infer<typeof rejectReceiptSchema>;

export const paymentDetailsSchema = z.strictObject({
  accountName: text(120),
  bankName: text(120),
  bsb: text(20),
  accountNumber: text(40),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code'),
  instructions: z.string().trim().max(500).optional(),
});
export type PaymentDetailsInput = z.infer<typeof paymentDetailsSchema>;

export interface ReceiptDto {
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  fileName: string;
  reason?: string;
}

export interface InvoiceDto {
  id: string;
  number: string;
  parentId: string;
  parentName: string;
  /** Each child, with the group they were billed under. */
  students: { id: string; name: string; groupId?: string; groupName?: string }[];
  /** Every group on this invoice, once each. */
  groups: { id: string; name: string }[];
  groupId?: string;
  description: string;
  amountCents: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  periodMonth: string;
  status: InvoiceStatus;
  receipt?: ReceiptDto;
  paidAt?: string;
  /** Overdue reminders emailed so far, and when the last one went. */
  reminders?: { count: number; lastAt?: string };
}

export interface InvoiceStatsDto {
  invoicedCents: number;
  paidCents: number;
  pendingCents: number;
  overdueCents: number;
  collectedPercent: number;
}

export interface GroupInvoiceResultDto {
  /** New invoices made in this batch. */
  created: number;
  /** Families that already had this group billed for the month. */
  skipped: number;
  /** Families whose charge was added to an invoice they already had open this month. */
  merged: number;
  /** Families looked at in this batch, and in the whole group. */
  processed: number;
  total: number;
  /** Present while more families remain: send it back as `offset`. */
  nextOffset?: number;
}

export interface ParentInvoicesDto {
  invoices: InvoiceDto[];
  outstandingCents: number;
  overdueCents: number;
  paidCents: number;
  paidThisYearCents: number;
  invoicedCents: number;
  nextDueDate?: string;
}

export interface PaymentDetailsDto extends PaymentDetailsInput {
  updatedAt: string;
}
