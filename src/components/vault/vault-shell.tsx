'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { useVaultKey } from '@/lib/vault/vault-key-context';
import { VaultApp } from './vault-app';

/**
 * The unlocked vault surface. The in-memory key is the source of truth for
 * "unlocked": if it is absent (fresh load, after Lock, or after a refresh) we
 * bounce to /unlock. Server-side guards only know you are signed in and
 * onboarded, not whether the vault is currently unlocked.
 */
export function VaultShell({ email }: { email: string }) {
  const router = useRouter();
  const { isUnlocked, lock } = useVaultKey();

  useEffect(() => {
    if (!isUnlocked) router.replace('/unlock');
  }, [isUnlocked, router]);

  if (!isUnlocked) return null;

  function onLock() {
    lock();
    router.replace('/unlock');
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold">Vaulty</span>
          <span className="text-sm text-muted-foreground">{email}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onLock}>
            Lock
          </Button>
          <SignOutButton />
        </div>
      </header>
      <VaultApp />
    </div>
  );
}
