import { AuthLayout, Empty } from '@/lib/ui';

export default function UnknownSitePage() {
  return (
    <AuthLayout site="Edura" title="Unknown address" headline="Wrong turn." lead="Let’s find your academy.">
      <Empty icon="globe" title="We can’t find that academy" body="Check the web address, or ask your academy for the correct link." />
    </AuthLayout>
  );
}
