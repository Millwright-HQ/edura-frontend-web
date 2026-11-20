import { redirect } from 'next/navigation';

/** Weeks no longer have a page of their own: the course page opens them in place. Old links land there. */
export default async function WeekPage({ params }: { params: Promise<{ courseId: string; weekId: string }> }) {
  const { courseId, weekId } = await params;
  redirect(`/courses/${courseId}?open=${weekId}`);
}
