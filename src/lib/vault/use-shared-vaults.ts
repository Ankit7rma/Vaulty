'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  decryptString,
  encryptString,
  generateSymmetricVaultKey,
  importPublicKey,
  rsaDecrypt,
  rsaEncrypt,
  importSymmetricVaultKey,
} from '@/lib/crypto';
import { ensureKeypair, type LiveKeypair } from './keypair';

/**
 * Client-side model of shared vaults for the signed-in user.
 *
 * Each row in `vaults` carries the caller's `wrappedKey` — the vault's
 * symmetric key encrypted with the caller's RSA public key. We unwrap it
 * lazily (only when the user opens the vault) so we never hold every
 * vault's key in memory at once, and we cache the unwrapped CryptoKey by
 * vault id so switching between vaults is instant.
 */

export interface SharedVaultSummary {
  id: string;
  role: 'owner' | 'editor' | 'reader';
  ownerId: string;
  wrappedKey: string;
  // Encrypted display name from the server. Decrypted lazily with the vault key.
  name: string;
  nameIv: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RawVault {
  id: string;
  role: 'owner' | 'editor' | 'reader';
  ownerId: string;
  wrappedKey: string;
  name: string;
  nameIv: string;
  createdAt: string;
  updatedAt: string;
}

export interface UseSharedVaults {
  keypair: LiveKeypair | null;
  vaults: SharedVaultSummary[];
  loading: boolean;
  error: string | null;
  /** Reload the vaults list from the server. */
  reload: () => Promise<void>;
  /** Create a new shared vault. Returns the created row. */
  createVault: (name: string) => Promise<SharedVaultSummary>;
  /** Unwrap a vault's symmetric key and cache it in memory for later use. */
  getVaultKey: (vault: SharedVaultSummary) => Promise<CryptoKey>;
}

/**
 * Runs the whole "am I ready to touch shared vaults" pipeline:
 *   - lazy-enroll the RSA wrapping keypair (using the current vault key)
 *   - fetch the caller's shared vaults
 *   - decrypt each vault's display name in-memory
 *
 * The vaultKey argument is the user's PERSONAL vault AES key, used only to
 * unwrap the RSA private key. It is not stored anywhere except memory.
 */
export function useSharedVaults(vaultKey: CryptoKey | null): UseSharedVaults {
  const [keypair, setKeypair] = useState<LiveKeypair | null>(null);
  const [vaults, setVaults] = useState<SharedVaultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyCache, setKeyCache] = useState<Map<string, CryptoKey>>(
    () => new Map(),
  );

  const decryptName = useCallback(
    async (row: RawVault, sharedKey: CryptoKey): Promise<string> => {
      try {
        return await decryptString(sharedKey, { cipher: row.name, iv: row.nameIv });
      } catch {
        return '(unable to decrypt)';
      }
    },
    [],
  );

  const decryptSummaries = useCallback(
    async (
      rows: RawVault[],
      pair: LiveKeypair,
    ): Promise<SharedVaultSummary[]> => {
      return Promise.all(
        rows.map(async (row) => {
          try {
            const rawKey = await rsaDecrypt(pair.privateKey, row.wrappedKey);
            const sharedKey = await importSymmetricVaultKey(rawKey);
            const displayName = await decryptName(row, sharedKey);
            setKeyCache((prev) => {
              if (prev.get(row.id) === sharedKey) return prev;
              const next = new Map(prev);
              next.set(row.id, sharedKey);
              return next;
            });
            return {
              id: row.id,
              role: row.role,
              ownerId: row.ownerId,
              wrappedKey: row.wrappedKey,
              name: row.name,
              nameIv: row.nameIv,
              displayName,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
            };
          } catch {
            // Wrapped key can't be unwrapped: probably a key rotation the
            // client hasn't caught up with yet. Surface as (locked).
            return {
              id: row.id,
              role: row.role,
              ownerId: row.ownerId,
              wrappedKey: row.wrappedKey,
              name: row.name,
              nameIv: row.nameIv,
              displayName: null,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
            };
          }
        }),
      );
    },
    [decryptName],
  );

  const reload = useCallback(async () => {
    if (!vaultKey) return;
    setLoading(true);
    setError(null);
    try {
      const pair = keypair ?? (await ensureKeypair(vaultKey));
      if (!keypair) setKeypair(pair);
      const res = await fetch('/api/vaults', { cache: 'no-store' });
      if (!res.ok) throw new Error('load failed');
      const data = (await res.json()) as { vaults: RawVault[] };
      const summaries = await decryptSummaries(data.vaults, pair);
      setVaults(summaries);
    } catch {
      setError('Could not load your shared vaults.');
    } finally {
      setLoading(false);
    }
  }, [vaultKey, keypair, decryptSummaries]);

  useEffect(() => {
    if (!vaultKey) return;
    let cancelled = false;
    (async () => {
      try {
        const pair = await ensureKeypair(vaultKey);
        if (cancelled) return;
        setKeypair(pair);
        const res = await fetch('/api/vaults', { cache: 'no-store' });
        if (!res.ok) throw new Error('load failed');
        const data = (await res.json()) as { vaults: RawVault[] };
        const summaries = await decryptSummaries(data.vaults, pair);
        if (cancelled) return;
        setVaults(summaries);
      } catch {
        if (!cancelled) setError('Could not load your shared vaults.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultKey, decryptSummaries]);

  const createVault = useCallback(
    async (name: string): Promise<SharedVaultSummary> => {
      if (!vaultKey) throw new Error('Vault is locked.');
      const pair = keypair ?? (await ensureKeypair(vaultKey));
      if (!keypair) setKeypair(pair);
      const { key: sharedKey, raw } = await generateSymmetricVaultKey();
      const nameBlob = await encryptString(sharedKey, name);
      const wrappedKey = await rsaEncrypt(pair.publicKey, raw);
      const res = await fetch('/api/vaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameBlob.cipher,
          nameIv: nameBlob.iv,
          wrappedKey,
        }),
      });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({}))).error ?? 'create failed');
      }
      const { vault } = (await res.json()) as { vault: RawVault };
      // Skip the round-trip decrypt: we already know the name locally.
      const summary: SharedVaultSummary = {
        id: vault.id,
        role: vault.role,
        ownerId: vault.ownerId,
        wrappedKey: vault.wrappedKey,
        name: vault.name,
        nameIv: vault.nameIv,
        displayName: name,
        createdAt: vault.createdAt,
        updatedAt: vault.updatedAt,
      };
      setKeyCache((prev) => {
        const next = new Map(prev);
        next.set(vault.id, sharedKey);
        return next;
      });
      setVaults((prev) => [summary, ...prev]);
      return summary;
    },
    [vaultKey, keypair],
  );

  const getVaultKey = useCallback(
    async (vault: SharedVaultSummary): Promise<CryptoKey> => {
      const cached = keyCache.get(vault.id);
      if (cached) return cached;
      if (!vaultKey) throw new Error('Vault is locked.');
      const pair = keypair ?? (await ensureKeypair(vaultKey));
      if (!keypair) setKeypair(pair);
      const raw = await rsaDecrypt(pair.privateKey, vault.wrappedKey);
      const sharedKey = await importSymmetricVaultKey(raw);
      setKeyCache((prev) => {
        const next = new Map(prev);
        next.set(vault.id, sharedKey);
        return next;
      });
      return sharedKey;
    },
    [keyCache, keypair, vaultKey],
  );

  return { keypair, vaults, loading, error, reload, createVault, getVaultKey };
}

/** Public key of another user, needed when wrapping the vault key at invite time. */
export interface LookedUpPublicKey {
  id: string;
  email: string;
  publicKey: string;
}

export async function lookupUserPublicKey(email: string): Promise<LookedUpPublicKey | null> {
  const res = await fetch(
    `/api/users/lookup?email=${encodeURIComponent(email)}`,
    { cache: 'no-store' },
  );
  if (!res.ok) return null;
  return (await res.json()) as LookedUpPublicKey;
}

/** Client-side helper: wrap a raw vault-key (32 bytes) against a recipient's public key. */
export async function wrapVaultKeyForRecipient(
  rawKey: Uint8Array,
  publicKeySpki: string,
): Promise<string> {
  const publicKey = await importPublicKey(publicKeySpki);
  return rsaEncrypt(publicKey, rawKey);
}
