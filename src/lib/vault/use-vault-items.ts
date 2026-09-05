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
 * memory with the vault key. All CRUD encrypts client-side before sending.
 */
export function useVaultItems(key: CryptoKey): UseVaultItems {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch + decrypt with no state writes, so it can run from the mount effect
  // (which must not setState synchronously) and from the manual reload alike.
  const fetchItems = useCallback(async (): Promise<VaultItem[]> => {
    const res = await fetch('/api/vault/items');
    if (!res.ok) throw new Error('load failed');
    const data = (await res.json()) as { items: ItemRecord[] };
    return Promise.all(data.items.map((record) => decryptRecord(key, record)));
  }, [key]);

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
      const res = await fetch('/api/vault/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...blob }),
      });
      if (!res.ok) throw new Error('create failed');
      const { item } = (await res.json()) as { item: ItemRecord };
      const decrypted = await decryptRecord(key, item);
      setItems((prev) => [decrypted, ...prev]);
    },
    [key],
  );

  const updateItem = useCallback(
    async (id: string, type: ItemType, fields: ItemFields) => {
      const blob = await encryptFields(key, fields);
      const res = await fetch(`/api/vault/items/${id}`, {
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
    [key],
  );

  const deleteItem = useCallback(async (id: string) => {
    const res = await fetch(`/api/vault/items/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('delete failed');
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return { items, loading, error, createItem, updateItem, deleteItem, reload };
}
