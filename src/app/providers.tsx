'use client';

import type { ReactNode } from 'react';
import { VaultKeyProvider } from '@/lib/vault/vault-key-context';
import { SettingsProvider } from '@/lib/settings/settings-context';

/** Client-side context providers mounted once at the root layout. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <VaultKeyProvider>{children}</VaultKeyProvider>
    </SettingsProvider>
  );
}
