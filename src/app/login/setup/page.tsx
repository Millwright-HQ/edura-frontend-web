import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { confirmMfaSetup, startMfaSetup } from '@/app/actions';
import { ActionForm } from '@/lib/action-form';
import { MFA_COOKIE } from '@/lib/cookies';
import { getSite, siteName } from '@/lib/server';
import { getPublicSite } from '@/lib/site';
import { AuthLayout, BrandStyle, Field } from '@/lib/ui';

export default async function SetupPage() {
  if (!(await cookies()).get(MFA_COOKIE)) redirect('/login');
  const [site, publicSite, setup] = await Promise.all([getSite(), getPublicSite(), startMfaSetup()]);
  if (!setup) redirect('/login');
  const name = publicSite?.displayName || siteName(site);
  return (
    <>
      <BrandStyle color={publicSite?.primaryColor} />
      <AuthLayout site={name} title="Set up two-step sign-in" sub="Your academy requires an authenticator app for your role." headline="Protect your account." lead="Use any authenticator app, such as Google Authenticator, Microsoft Authenticator or Authy.">
        <p>
          In the app choose <strong>Add account</strong> then <strong>Enter a setup key</strong>, and type this key:
        </p>
        <p className="mono" translate="no" aria-label="Setup key">
          {setup.secret}
        </p>
        <ActionForm action={confirmMfaSetup} submitLabel="Turn on and sign in">
          <Field label="6-digit code from the app" name="code" autoComplete="one-time-code" />
        </ActionForm>
        <p className="muted small">After you confirm, you will be shown recovery codes once. Keep them: each works one time if you lose your phone.</p>
      </AuthLayout>
    </>
  );
}
