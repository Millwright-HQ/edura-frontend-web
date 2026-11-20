import Link from 'next/link';
import { login, switchProfile } from '@/app/actions';
import { ActionForm } from '@/lib/action-form';
import { getSite, siteName } from '@/lib/server';
import { getPublicSite } from '@/lib/site';
import { AuthLayout, BrandStyle, Field, getDemoProfiles, Toggle } from '@/lib/ui';

const LABEL = { student: 'Student', parent: 'Parent', admin: 'Admin' } as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; passwordSet?: string }>;
}) {
  const [site, query, publicSite] = await Promise.all([getSite(), searchParams, getPublicSite()]);
  const isTenant = site.kind === 'tenant';
  const name = publicSite?.displayName || siteName(site);
  const profiles = isTenant ? await getDemoProfiles() : [];

  return (
    <>
      <BrandStyle color={publicSite?.primaryColor} />
      <AuthLayout
        site={name}
        title={isTenant ? 'Welcome back' : 'Platform sign in'}
        sub={isTenant ? `Sign in to ${name}.` : 'For Edura staff. Academy users sign in at their academy’s address.'}
        headline={isTenant ? 'Pick up right where you left off.' : 'The Edura control room.'}
        lead={isTenant ? 'Your classes, recordings and worksheets are waiting.' : 'Academies, billing, usage and platform staff.'}
      >
        {query.passwordSet && (
          <p className="notice notice-success" role="status">
            Your password is set. You can sign in now.
          </p>
        )}
        <ActionForm action={login} submitLabel="Sign in">
          <input type="hidden" name="next" value={query.next ?? '/'} />
          <Field label="Email" name="email" type="email" autoComplete="username" />
          <Field label="Password" name="password" type="password" autoComplete="current-password" />
          <div className="auth-row">
            <Toggle label="Keep me signed in" name="keepSignedIn" />
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
        </ActionForm>
        {profiles.length > 0 && (
          <div className="demo-box">
            <span>Demo: open a profile, no password</span>
            <div className="demo-buttons">
              {(['student', 'parent', 'admin'] as const)
                .filter((profile) => profiles.some((p) => p.profile === profile))
                .map((profile) => (
                  <form key={profile} action={switchProfile.bind(null, profile)}>
                    <button className="button-quiet button-block" type="submit">
                      {LABEL[profile]}
                    </button>
                  </form>
                ))}
            </div>
          </div>
        )}
        {isTenant && (
          <p className="auth-links">
            New here? <Link href="/join">Enrol now</Link>
          </p>
        )}
      </AuthLayout>
    </>
  );
}
