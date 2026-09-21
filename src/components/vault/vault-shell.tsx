'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { ThemeToggle } from '@/components/theme-toggle';
import { SettingsDialog } from './settings-dialog';
import { VaultApp } from './vault-app';
import { VaultSwitcher, type VaultScope } from './vault-switcher';
import { CreateSharedVaultDialog } from './create-shared-vault-dialog';
import { panicWipeLocal } from '@/lib/vault/panic-wipe';
import { useVaultKey } from '@/lib/vault/vault-key-context';
import { useSettings } from '@/lib/settings/settings-context';
import { useAutoLock } from '@/lib/vault/use-auto-lock';
import { useSharedVaults } from '@/lib/vault/use-shared-vaults';

/**
 * The unlocked vault surface. The in-memory key is the source of truth for
 * "unlocked": if it is absent (fresh load, after Lock, or after a refresh) we
 * bounce to /unlock. Server-side guards only know you are signed in and
 * onboarded, not whether the vault is currently unlocked.
 */
export function VaultShell({ email }: { email: string }) {
  const router = useRouter();
  const { isUnlocked, lock, key } = useVaultKey();
  const { autoLockMinutes } = useSettings();
  const [scope, setScope] = useState<VaultScope>({ kind: 'personal' });
  const [createOpen, setCreateOpen] = useState(false);
  const sharedVaults = useSharedVaults(key);

  const handleLock = useCallback(() => {
    lock();
    router.replace('/unlock');
  }, [lock, router]);

  const handleSignOut = useCallback(async () => {
    lock();
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
    router.refresh();
  }, [lock, router]);

  const handlePanicWipe = useCallback(async () => {
    lock();
    await panicWipeLocal();
    router.push('/login');
    router.refresh();
  }, [lock, router]);

  useEffect(() => {
    if (!isUnlocked) router.replace('/unlock');
  }, [isUnlocked, router]);

  // Auto-lock on inactivity, only while unlocked.
  useAutoLock(isUnlocked ? autoLockMinutes : 0, handleLock);

  if (!isUnlocked) return null;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold">Vaulty</span>
          <span className="text-sm text-muted-foreground">{email}</span>
          <VaultSwitcher
            active={scope}
            vaults={sharedVaults.vaults}
            loading={sharedVaults.loading}
            onSelect={setScope}
            onCreate={() => setCreateOpen(true)}
          />
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SettingsDialog />
          <Button variant="outline" onClick={handleLock}>
            Lock
          </Button>
          <SignOutButton />
        </div>
      </header>
      <VaultApp
        scope={scope}
        sharedVaults={sharedVaults}
        onLock={handleLock}
        onSignOut={handleSignOut}
        onPanicWipe={handlePanicWipe}
      />
      <CreateSharedVaultDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={sharedVaults.createVault}
        onCreated={(vault) => setScope({ kind: 'shared', id: vault.id })}
      />
    </div>
  );
}
