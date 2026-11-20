import { redirect } from 'next/navigation';

/** Classes are now edited in a pop-up on the schedule, so older links land there. */
export default function EditSessionPage() {
  redirect('/schedule');
}
