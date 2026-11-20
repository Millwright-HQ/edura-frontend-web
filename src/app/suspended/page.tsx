import { AuthLayout, Empty } from '@/lib/ui';

export default function SuspendedPage() {
  return (
    <AuthLayout site="Edura" title="Access is paused" headline="We’ll be back." lead="Access is paused for now.">
      <Empty icon="shield" title="This academy is unavailable" body="Sign-in is paused. Please contact the academy for help." />
    </AuthLayout>
  );
}
