import { z } from 'zod';
import { tenantIdSchema } from './tenants';

export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * logo and tutor: shown on the academy's public page, so anyone can see them.
 * person: a profile photo, shown only to people who may see that person.
 */
export const IMAGE_PURPOSES = ['logo', 'tutor', 'person'] as const;
export type ImagePurpose = (typeof IMAGE_PURPOSES)[number];

export const startImageSchema = z.strictObject({
  purpose: z.enum(IMAGE_PURPOSES),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(IMAGE_MIME_TYPES, { error: 'Use a PNG, JPEG or WebP image' }),
  size: z.number().int().positive().max(MAX_IMAGE_BYTES, 'Images can be up to 5 MB'),
});
export type StartImageInput = z.infer<typeof startImageSchema>;

export const imageIdSchema = tenantIdSchema;

export interface StartImageResult {
  imageId: string;
  uploadUrl: string;
}
export interface ImageUrlDto {
  url: string;
}
