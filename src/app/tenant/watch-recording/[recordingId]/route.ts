import { NextResponse } from 'next/server';
import { callAsUser } from '@/lib/server';

export async function GET(_: Request, { params }: { params: Promise<{ recordingId: string }> }) {
  const { recordingId } = await params;
  const result = await callAsUser<{ url: string }>('classes', `/recordings/${recordingId}/watch`);
  if (!result.ok) return new NextResponse('This recording could not be opened.', { status: result.status });
  return NextResponse.redirect(result.data.url, 302);
}
