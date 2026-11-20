import type { ContentAccessDto } from '@edura/contracts';
import { NextResponse } from 'next/server';
import { callAsUser } from '@/lib/server';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ courseId: string; weekId: string; itemId: string }> },
) {
  const { courseId, weekId, itemId } = await params;
  const result = await callAsUser<ContentAccessDto>(
    'academic',
    `/courses/${courseId}/weeks/${weekId}/items/${itemId}/access?download=1`,
  );
  if (!result.ok) {
    return new NextResponse('This file cannot be downloaded.', { status: result.status });
  }
  return NextResponse.redirect(result.data.url, 302);
}
