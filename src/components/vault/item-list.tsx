'use client';

import { KeyRound, StickyNote } from 'lucide-react';
import type { VaultItem } from '@/lib/vault/items';

function subtitle(item: VaultItem): string {
  if (item.type === 'login') return item.fields.username || 'No username';
  return 'Secure note';
}

export function ItemList({
  items,
  onOpen,
}: {
  items: VaultItem[];
  onOpen: (item: VaultItem) => void;
}) {
  return (
    <ul className="divide-y rounded-lg border">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted"
          >
            {item.type === 'login' ? (
              <KeyRound className="shrink-0 text-muted-foreground" />
            ) : (
              <StickyNote className="shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <p className="truncate font-medium">
                {item.fields.title || 'Untitled'}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {subtitle(item)}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
