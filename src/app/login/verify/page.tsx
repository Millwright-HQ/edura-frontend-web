import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyMfa } from '@/app/actions';
import { ActionForm } from '@/lib/action-form';
import { MFA_COOKIE } from '@/lib/cookies';
import { getSite, siteName } from '@/lib/server';
import { getPublicSite } from '@/lib/site';
import { AuthLayout, BrandStyle, Field } from '@/lib/ui';

export default async function VerifyPage() {
  if (!(await cookies()).get(MFA_COOKIE)) redirect('/login');
  const [site, publicSite] = await Promise.all([getSite(), getPublicSite()]);
  const name = publicSite?.displayName || siteName(site);
  return (
    <>
      <BrandStyle color={publicSite?.primaryColor} />
      <AuthLayout site={name} title="Two-step sign-in" sub="Enter the 6-digit code from your authenticator app." headline="One more step." lead="This keeps your academy safe even if a password leaks.">
        <ActionForm action={verifyMfa} submitLabel="Verify">
          <Field label="Code" name="code" autoComplete="one-time-code" hint="Lost your phone? Use one of your recovery codes instead." />
        </ActionForm>
      </AuthLayout>
    </>
  );
}
