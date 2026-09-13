'use client';

import { RotateCcw, Star } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { isFavorite, type VaultItem } from '@/lib/vault/items';
import { useSettings } from '@/lib/settings/settings-context';
import { ItemAvatar } from './item-avatar';

function subtitle(item: VaultItem): string {
  if (item.type === 'login') return item.fields.username || 'No username';
  return 'Secure note';
}

export function ItemList({
  items,
  onOpen,
  onToggleFavorite,
  onRestore,
  selectedIds,
  onToggleSelect,
}: {
  items: VaultItem[];
  onOpen: (item: VaultItem) => void;
  onToggleFavorite: (item: VaultItem) => void;
  /** When provided (trash view), replaces the star with a Restore action. */
  onRestore?: (item: VaultItem) => void;
  selectedIds: Set<string>;
  onToggleSelect: (item: VaultItem) => void;
}) {
  const { showFavicons } = useSettings();
  return (
    <ul className="divide-y rounded-lg border">
      {items.map((item) => {
        const fav = isFavorite(item);
        const selected = selectedIds.has(item.id);
        return (
          <li key={item.id}>
            <div
              className={`flex items-center gap-1 pr-2 hover:bg-muted ${
                selected ? 'bg-primary/5' : ''
              }`}
            >
              <label
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center pl-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onToggleSelect(item)}
                  aria-label={`Select ${item.fields.title || 'item'}`}
                />
              </label>
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left"
              >
                <ItemAvatar item={item} showFavicon={showFavicons} />
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {item.fields.title || 'Untitled'}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {subtitle(item)}
                  </p>
                </div>
              </button>
              {onRestore ? (
                <button
                  type="button"
                  onClick={() => onRestore(item)}
                  aria-label="Restore item"
                  title="Restore to vault"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted-foreground/10 hover:text-foreground"
                >
                  <RotateCcw className="size-4" aria-hidden />
                </button>
              ) : (
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
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
