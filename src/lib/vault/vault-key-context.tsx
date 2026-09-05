'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Holds the derived vault key (a non-extractable AES-GCM CryptoKey) in memory
 * for the session. It is never persisted to storage. Because it lives only in
 * React state, a full page reload or tab close drops it and the vault re-locks,
 * which is exactly the behaviour we want.
 */

interface VaultKeyContextValue {
  key: CryptoKey | null;
  isUnlocked: boolean;
  /** Store the derived key after a successful onboard or unlock. */
  unlock: (key: CryptoKey) => void;
  /** Wipe the key from memory (manual Lock, logout). */
  lock: () => void;
}

const VaultKeyContext = createContext<VaultKeyContextValue | null>(null);

export function VaultKeyProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<CryptoKey | null>(null);

  const unlock = useCallback((next: CryptoKey) => setKey(next), []);
  const lock = useCallback(() => setKey(null), []);

  const value = useMemo<VaultKeyContextValue>(
    () => ({ key, isUnlocked: key !== null, unlock, lock }),
    [key, unlock, lock],
  );

  return (
    <VaultKeyContext.Provider value={value}>
      {children}
    </VaultKeyContext.Provider>
  );
}

export function useVaultKey(): VaultKeyContextValue {
  const ctx = useContext(VaultKeyContext);
  if (!ctx) {
    throw new Error('useVaultKey must be used within a VaultKeyProvider');
  }
  return ctx;
}
