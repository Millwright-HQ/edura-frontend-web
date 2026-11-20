import { z } from 'zod';
import { emailSchema } from './identity';
import { tenantIdSchema } from './tenants';

const ulid = tenantIdSchema;
const text = (max: number) => z.string().trim().min(1).max(max);

export const announcementInputSchema = z
  .strictObject({
    title: text(160),
    body: text(5000),
    audience: z.enum(['tenant', 'group', 'course']),
    audienceIds: z.array(ulid).max(20).default([]),
    /** Also email it to the families it is for. On unless turned off. */
    sendEmail: z.boolean().default(true),
  })
  .refine((v) => v.audience === 'tenant' || v.audienceIds.length > 0, {
    message: 'Choose who should see this',
    path: ['audienceIds'],
  });
export type AnnouncementInput = z.infer<typeof announcementInputSchema>;

export interface AnnouncementDto {
  id: string;
  title: string;
  body: string;
  audience: 'tenant' | 'group' | 'course';
  audienceIds: string[];
  publishedAt: string;
}

export interface NotificationDto {
  id: string;
  title: string;
  body?: string;
  href?: string;
  at: string;
  unread: boolean;
}

export interface NotificationsDto {
  items: NotificationDto[];
  unread: number;
}

export const ENQUIRY_STATUSES = ['new', 'contacted', 'converted', 'closed'] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const enquiryInputSchema = z.strictObject({
  host: z.string().min(1).max(300),
  /** Hidden from people. Only automated form-fillers complete it. */
  website: z.string().max(200).optional(),
  name: text(120),
  email: emailSchema,
  phone: z.string().trim().max(30).optional(),
  message: text(2000),
});
export type EnquiryInput = z.infer<typeof enquiryInputSchema>;

export const listEnquiriesQuerySchema = z.object({
  status: z.enum(ENQUIRY_STATUSES).default('new'),
});
export type ListEnquiriesQuery = z.infer<typeof listEnquiriesQuerySchema>;

export const setEnquiryStatusSchema = z.strictObject({ status: z.enum(ENQUIRY_STATUSES) });
export type SetEnquiryStatusInput = z.infer<typeof setEnquiryStatusSchema>;

export interface EnquiryDto {
  id: string;
  status: EnquiryStatus;
  name: string;
  email: string;
  phone?: string;
  message: string;
  createdAt: string;
}

export const feedbackInputSchema = z.strictObject({
  studentName: text(80),
  year: z.number().int().min(2000).max(2100),
  quote: text(1000),
  published: z.boolean(),
});
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

export const listFeedbackQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  search: z.string().trim().max(100).optional(),
});
export type ListFeedbackQuery = z.infer<typeof listFeedbackQuerySchema>;

export interface FeedbackDto extends FeedbackInput {
  id: string;
  createdAt: string;
}

const listOf = <T extends z.ZodType>(item: T, max: number) => z.array(item).max(max).default([]);

export const siteSettingsSchema = z.strictObject({
  displayName: text(120),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour such as #4a3ae8'),
  timezone: text(60),
  tagline: z.string().trim().max(200).default(''),
  about: z.string().trim().max(3000).default(''),
  contactEmail: z.union([emailSchema, z.literal('')]).default(''),
  contactPhone: z.string().trim().max(30).default(''),
  programs: listOf(z.strictObject({ title: text(120), description: text(600) }), 20),
  faqs: listOf(z.strictObject({ question: text(200), answer: text(1000) }), 30),
  address: z.string().trim().max(200).default(''),
  openingHours: z.string().trim().max(200).default(''),
  /** Short facts shown as a strip under the introduction, such as "12" and "Years teaching". */
  stats: listOf(z.strictObject({ value: text(20), label: text(60) }), 4),
  /** Why families choose the academy. */
  highlights: listOf(z.strictObject({ title: text(100), description: text(400) }), 6),
  /** An image uploaded through the media routes. Empty means none. */
  logoImageId: z.string().max(40).default(''),
  tutors: listOf(
    z.strictObject({
      name: text(80),
      subject: z.string().trim().max(120).default(''),
      bio: z.string().trim().max(800).default(''),
      imageId: z.string().max(40).default(''),
    }),
    20,
  ),
});
export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;

export interface PublicSiteDto extends SiteSettingsInput {
  testimonials: { studentName: string; year: number; quote: string }[];
}

export const DEFAULT_SITE: SiteSettingsInput = {
  displayName: '',
  primaryColor: '#4a3ae8',
  timezone: 'Asia/Colombo',
  tagline: '',
  about: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
  openingHours: '',
  stats: [],
  highlights: [],
  programs: [],
  faqs: [],
  logoImageId: '',
  tutors: [],
};
