import { AccountScreen } from '@/lib/admin-screens';
import { getMe } from '@/lib/server';

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ mfa?: string }> }) {
  const [me, query] = await Promise.all([getMe(), searchParams]);
  return <AccountScreen me={me} setup={query.mfa === 'setup'} />;
}
