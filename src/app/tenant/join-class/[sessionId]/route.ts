import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { callAsUser, errorMessage, getClassMode } from '@/lib/server';

/** `?part=2` picks the second meeting of a class that a free Zoom account cut into several. */
export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const part = new URL(request.url).searchParams.get('part');
  // The person's choice (Settings, Account) decides where a class opens; `?via=app` or `?via=web` overrides it once.
  const via = new URL(request.url).searchParams.get('via');
  const mode = via === 'app' || via === 'web' ? via : await getClassMode();
  if (mode === 'web') {
    // Next reports its own address (localhost) as the request's, so the academy's address comes from the headers the visitor used.
    const sent = await headers();
    const host = sent.get('x-forwarded-host') ?? sent.get('host') ?? new URL(request.url).host;
    const protocol = new URL(request.url).protocol;
    const suffix = part && /^\d{1,2}$/.test(part) ? `?part=${part}` : '';
    return NextResponse.redirect(new URL(`/live/${sessionId}${suffix}`, `${protocol}//${host}`), 302);
  }
  const query = part && /^\d{1,2}$/.test(part) ? `?part=${part}` : '';
  const result = await callAsUser<{ url: string }>('classes', `/me/sessions/${sessionId}/join${query}`, { method: 'POST' });
  if (!result.ok) {
    return new NextResponse(errorMessage(result, 'This class is not open to join yet.'), { status: result.status });
  }
  return NextResponse.redirect(result.data.url, 302);
}
