'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  decryptRecord,
  encryptFields,
  type ItemFields,
  type ItemRecord,
  type ItemType,
  type VaultItem,
} from './items';

export interface UseVaultItems {
  items: VaultItem[];
  loading: boolean;
  error: string | null;
  createItem: (type: ItemType, fields: ItemFields) => Promise<void>;
  updateItem: (id: string, type: ItemType, fields: ItemFields) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

function byUpdatedDesc(items: VaultItem[]): VaultItem[] {
  return [...items].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/**
 * Loads the encrypted item records for the current user and decrypts them in
 * memory with the given key. All CRUD encrypts client-side before sending.
 *
 * When `sharedVaultId` is set, the hook hits /api/vaults/[id]/items instead
 * of the personal /api/vault/items and uses the shared vault's symmetric
 * key (which the caller must have already unwrapped). Otherwise the caller
 * passes their personal master-derived vault key.
 */
export function useVaultItems(
  key: CryptoKey,
  sharedVaultId?: string,
): UseVaultItems {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = sharedVaultId
    ? `/api/vaults/${sharedVaultId}/items`
    : '/api/vault/items';

  const fetchItems = useCallback(async (): Promise<VaultItem[]> => {
    const res = await fetch(baseUrl);
    if (!res.ok) throw new Error('load failed');
    const data = (await res.json()) as { items: ItemRecord[] };
    return Promise.all(data.items.map((record) => decryptRecord(key, record)));
  }, [key, baseUrl]);

  useEffect(() => {
    let cancelled = false;
    fetchItems()
      .then((decrypted) => {
        if (cancelled) return;
        setItems(decrypted);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not load your vault items.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchItems]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchItems());
    } catch {
      setError('Could not load your vault items.');
    } finally {
      setLoading(false);
    }
  }, [fetchItems]);

  const createItem = useCallback(
    async (type: ItemType, fields: ItemFields) => {
      const blob = await encryptFields(key, fields);
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...blob }),
      });
      if (!res.ok) throw new Error('create failed');
      const { item } = (await res.json()) as { item: ItemRecord };
      const decrypted = await decryptRecord(key, item);
      setItems((prev) => [decrypted, ...prev]);
    },
    [key, baseUrl],
  );

  const updateItem = useCallback(
    async (id: string, type: ItemType, fields: ItemFields) => {
      const blob = await encryptFields(key, fields);
      const res = await fetch(`${baseUrl}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...blob }),
      });
      if (!res.ok) throw new Error('update failed');
      const { item } = (await res.json()) as { item: ItemRecord };
      const decrypted = await decryptRecord(key, item);
      setItems((prev) =>
        byUpdatedDesc([decrypted, ...prev.filter((i) => i.id !== id)]),
      );
    },
    [key, baseUrl],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      const res = await fetch(`${baseUrl}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      setItems((prev) => prev.filter((i) => i.id !== id));
    },
    [baseUrl],
  );

  return { items, loading, error, createItem, updateItem, deleteItem, reload };
}
