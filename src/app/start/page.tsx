import { Captcha } from '@/lib/captcha-widget';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { submitAcademyRequest } from '@/app/actions';
import { ActionForm } from '@/lib/action-form';
import { getSite } from '@/lib/server';
import { AuthLayout, Empty, Field } from '@/lib/ui';
import { headers } from 'next/headers';

/** Asks for an academy. Platform staff create it and email a link to set a password. */
export default async function StartPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const [site, query, requestHeaders] = await Promise.all([getSite(), searchParams, headers()]);
  if (site.kind !== 'platform') notFound();
  const apex = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? '';

  if (query.sent) {
    return (
      <AuthLayout site="Edura" title="Almost there" headline="Almost there." lead="Your academy will be ready soon.">
        <Empty icon="check" title="Thanks, we’re on it" body="We’ll email you when your academy is ready, with a link to choose your password.">
          <Link className="button" href="/">
            Back to home
          </Link>
        </Empty>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout
      site="Edura"
      title="Start your academy"
      sub="Tell us who you are and choose your web address."
      headline="Open your academy in minutes."
      lead="Your classes, content and invoices, under your own name."
    >
      <ActionForm action={submitAcademyRequest} submitLabel="Request my academy">
        <Field label="Academy name" name="name" />
        <Field label="Web address" name="slug" placeholder="youracademy" hint={`Your site will be youracademy.${apex}`} />
        <div className="form-grid">
          <Field label="Your first name" name="firstName" autoComplete="given-name" />
          <Field label="Your last name" name="lastName" autoComplete="family-name" />
        </div>
        <Field label="Work email" name="email" type="email" autoComplete="email" />
        <div className="visually-hidden" aria-hidden="true">
          <label>
            Website
            <input name="website" type="text" tabIndex={-1} autoComplete="off" />
          </label>
          <Captcha />
        </div>
      </ActionForm>
      <p className="auth-links">
        Already with Edura? <Link href="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
