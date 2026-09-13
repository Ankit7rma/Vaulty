'use client';

import { KeyRound, Star, StickyNote } from 'lucide-react';
import { isFavorite, type VaultItem } from '@/lib/vault/items';

function subtitle(item: VaultItem): string {
  if (item.type === 'login') return item.fields.username || 'No username';
  return 'Secure note';
}

export function ItemList({
  items,
  onOpen,
  onToggleFavorite,
}: {
  items: VaultItem[];
  onOpen: (item: VaultItem) => void;
  onToggleFavorite: (item: VaultItem) => void;
}) {
  return (
    <ul className="divide-y rounded-lg border">
      {items.map((item) => {
        const fav = isFavorite(item);
        return (
          <li key={item.id}>
            <div className="flex items-center gap-1 pr-2 hover:bg-muted">
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
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
              <button
                type="button"
                onClick={() => onToggleFavorite(item)}
                aria-label={fav ? 'Unstar item' : 'Star item'}
                aria-pressed={fav}
                title={fav ? 'Starred' : 'Star this item'}
                className={`flex size-8 shrink-0 items-center justify-center rounded-md transition-colors ${
                  fav
                    ? 'text-amber-500 hover:bg-amber-500/10'
                    : 'text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground'
                }`}
              >
                <Star
                  className="size-4"
                  fill={fav ? 'currentColor' : 'none'}
                  aria-hidden
                />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
