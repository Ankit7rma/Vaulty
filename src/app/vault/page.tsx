import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/server';
import { VaultShell } from '@/components/vault/vault-shell';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function VaultPage() {
  const user = await requireUser();
  if (!user.onboarded) redirect('/onboard');

  return <VaultShell email={user.email} />;
}
