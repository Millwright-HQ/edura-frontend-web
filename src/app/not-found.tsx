import Link from 'next/link';
import { Empty } from '@/lib/ui';

export default function NotFound() {
  return (
    <div className="page">
      <Empty icon="globe" title="Page not found" body="That page doesn’t exist or has moved." heading="h1">
        <Link className="button" href="/">
          Go to the home page
        </Link>
      </Empty>
    </div>
  );
}
