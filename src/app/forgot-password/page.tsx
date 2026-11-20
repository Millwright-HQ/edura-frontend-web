import Link from 'next/link';
import { forgotPassword } from '@/app/actions';
import { ActionForm } from '@/lib/action-form';
import { getSite, siteName } from '@/lib/server';
import { AuthLayout, Field } from '@/lib/ui';

export default async function ForgotPasswordPage() {
  const site = await getSite();
  return (
    <AuthLayout
      site={siteName(site)}
      title="Reset your password"
      sub="We’ll email you a link to choose a new one."
      headline="Happens to everyone."
      lead="We’ll get you back in."
    >
      <ActionForm action={forgotPassword} submitLabel="Email me a link">
        <Field label="Email" name="email" type="email" autoComplete="username" />
      </ActionForm>
      <p className="auth-links">
        Remembered it? <Link href="/login">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
