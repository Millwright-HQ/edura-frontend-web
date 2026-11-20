import { NextResponse } from 'next/server';
import { callAsUser } from '@/lib/server';

export async function GET(_: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const result = await callAsUser<{ url: string }>('billing', `/invoices/${invoiceId}/receipt`);
  if (!result.ok) return new NextResponse('This receipt could not be opened.', { status: result.status });
  return NextResponse.redirect(result.data.url, 302);
}
