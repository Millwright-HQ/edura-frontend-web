import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSite } from '@/lib/server';
import { getPublicSite } from '@/lib/site';
import { AuthLayout, BrandStyle, Empty } from '@/lib/ui';
import { JoinForm } from './join-form';

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const [site, query, publicSite] = await Promise.all([getSite(), searchParams, getPublicSite()]);
  if (site.kind !== 'tenant') notFound();
  const name = publicSite?.displayName || site.name;
  return (
    <>
      <BrandStyle color={publicSite?.primaryColor} />
      {query.sent ? (
        <AuthLayout site={name} title="Thanks for applying" headline="We’ll be in touch soon." lead="The academy reviews every request.">
          <Empty icon="check" title="Request sent" body={`${name} will review it and share your login details.`}>
            <Link className="button" href="/">
              Back to the website
            </Link>
          </Empty>
        </AuthLayout>
      ) : (
        <AuthLayout
          site={name}
          title={`Enrol at ${name}`}
          sub="Send your details and the academy will set up your login."
          headline={`Join ${name}.`}
          lead="Live classes, recordings and worksheets, all in one place."
        >
          <JoinForm />
          <p className="auth-links">
            Already enrolled? <Link href="/login">Sign in</Link>
          </p>
        </AuthLayout>
      )}
    </>
  );
}
