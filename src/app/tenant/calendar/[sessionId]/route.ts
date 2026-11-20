import type { LearnerScheduleDto } from '@edura/contracts';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { callAsUser } from '@/lib/server';

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
/** Calendar files escape backslashes, commas, semicolons and line breaks. */
const text = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/[,;]/g, (c) => '\\' + c)
    .replace(/\r?\n/g, '\\n');

/** A calendar file for one class, for the student's own phone or computer calendar. Long classes get one event per meeting. */
export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const result = await callAsUser<LearnerScheduleDto>('classes', '/me/schedule');
  const session = result.ok ? [...result.data.upcoming, ...result.data.past].find((item) => item.id === sessionId) : undefined;
  if (!session) return new NextResponse('Class not found', { status: 404 });

  const sent = await headers();
  const host = sent.get('x-forwarded-host') ?? sent.get('host') ?? '';
  const proto = sent.get('x-forwarded-proto') ?? 'http';
  const link = host ? `${proto}://${host}/schedule` : '';
  const pieces = session.parts && session.parts.length > 1 ? session.parts : [{ part: 0, startsAt: session.startsAt, durationMinutes: session.durationMinutes }];
  const now = stamp(new Date().toISOString());
  const events = pieces.flatMap((piece) => [
    'BEGIN:VEVENT',
    `UID:${session.id}-${piece.part}@edura`,
    `DTSTAMP:${now}`,
    `DTSTART:${stamp(piece.startsAt)}`,
    `DTEND:${stamp(new Date(new Date(piece.startsAt).getTime() + piece.durationMinutes * 60_000).toISOString())}`,
    `SUMMARY:${text(piece.part ? `${session.topic} (part ${piece.part})` : session.topic)}`,
    ...(link ? [`DESCRIPTION:${text(`Join from your schedule: ${link}`)}`, `URL:${link}`] : []),
    'END:VEVENT',
  ]);
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Edura//Classes//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n') + '\r\n';
  return new NextResponse(body, {
    headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'attachment; filename="class.ics"' },
  });
}
