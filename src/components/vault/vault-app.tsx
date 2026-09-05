'use client';

import { useState } from 'react';
import { KeyRound, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVaultKey } from '@/lib/vault/vault-key-context';
import { useVaultItems } from '@/lib/vault/use-vault-items';
import type { ItemFields, ItemType } from '@/lib/vault/items';
import { ItemList } from './item-list';
import { ItemDialog, type EditingItem } from './item-dialog';

export function VaultApp() {
  const { key } = useVaultKey();
  // The shell guarantees the vault is unlocked before rendering this; the guard
  // is here only so the key is non-null for the inner component.
  if (!key) return null;
  return <VaultAppInner cryptoKey={key} />;
}

function VaultAppInner({ cryptoKey }: { cryptoKey: CryptoKey }) {
  const { items, loading, error, createItem, updateItem, deleteItem } =
    useVaultItems(cryptoKey);
  const [editing, setEditing] = useState<EditingItem | null>(null);

  async function handleSave(type: ItemType, fields: ItemFields, id?: string) {
    if (id) await updateItem(id, type, fields);
    else await createItem(type, fields);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    await deleteItem(id);
    setEditing(null);
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Your vault</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing({ type: 'login' })}>
            <KeyRound /> Add login
          </Button>
          <Button variant="outline" onClick={() => setEditing({ type: 'note' })}>
            <StickyNote /> Add note
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Decrypting your vault...</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            Your vault is empty. Add your first login or secure note.
          </p>
        </div>
      ) : (
        <ItemList
          items={items}
          onOpen={(item) => setEditing({ type: item.type, item })}
        />
      )}

      <ItemDialog
        editing={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </main>
  );
}
