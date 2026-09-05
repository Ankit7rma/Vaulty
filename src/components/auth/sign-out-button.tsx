'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useVaultKey } from '@/lib/vault/vault-key-context';

export function SignOutButton({
  variant = 'ghost',
}: {
  variant?: 'ghost' | 'outline';
}) {
  const router = useRouter();
  const { lock } = useVaultKey();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    lock(); // wipe the in-memory key before anything else
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
    router.refresh();
  }

  return (
    <Button variant={variant} onClick={onClick} disabled={busy}>
      {busy ? 'Signing out...' : 'Sign out'}
    </Button>
  );
}
