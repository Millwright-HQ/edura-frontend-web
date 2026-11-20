'use server';

import type { ImagePurpose, StartImageResult } from '@edura/contracts';
import { callAsUser, errorMessage } from '@/lib/server';

/** Step one of an image upload: ask for an address to send the file to. */
export async function startImage(input: {
  purpose: ImagePurpose;
  fileName: string;
  mimeType: string;
  size: number;
}): Promise<{ upload?: StartImageResult; error?: string }> {
  const result = await callAsUser<StartImageResult>('academic', '/media/images', { method: 'POST', body: input });
  return result.ok ? { upload: result.data } : { error: errorMessage(result, 'Could not start the upload') };
}

/** Step two: the service checks what arrived really is an image. */
export async function finishImage(imageId: string): Promise<{ imageId?: string; error?: string }> {
  const result = await callAsUser<{ imageId: string }>('academic', `/media/images/${imageId}/complete`, { method: 'POST' });
  return result.ok ? { imageId: result.data.imageId } : { error: errorMessage(result, 'That is not a valid image') };
}
