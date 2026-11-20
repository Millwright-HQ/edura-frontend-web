import { StaffScreen } from '@/lib/admin-screens';

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return <StaffScreen scope="platform" status={status ?? 'active'} />;
}
