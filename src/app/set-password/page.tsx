import { getSite, siteName } from '@/lib/server';
import { AuthLayout } from '@/lib/ui';
import { SetPasswordForm } from './set-password-form';

export default async function SetPasswordPage() {
  const site = await getSite();
  return (
    <AuthLayout site={siteName(site)} title="Choose a new password" headline="Nearly done." lead="Pick something only you know.">
      <SetPasswordForm />
    </AuthLayout>
  );
}
