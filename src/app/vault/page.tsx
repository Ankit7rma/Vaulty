import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/server';
import { VaultShell } from '@/components/vault/vault-shell';

export default async function VaultPage() {
  const user = await requireUser();
  if (!user.onboarded) redirect('/onboard');

  return <VaultShell email={user.email} />;
}
