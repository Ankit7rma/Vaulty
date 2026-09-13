'use client';

import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Search, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVaultKey } from '@/lib/vault/vault-key-context';
import { useVaultItems } from '@/lib/vault/use-vault-items';
import {
  collectTags,
  filterItems,
  getTags,
  isDeleted,
  isFavorite,
  type ItemFields,
  type ItemType,
  type VaultItem,
} from '@/lib/vault/items';
import { ItemList } from './item-list';
import { ItemDialog, type EditingItem } from './item-dialog';
import { CommandPalette } from './command-palette';
import { ShortcutsDialog } from './shortcuts-dialog';
import { BulkActionBar } from './bulk-action-bar';
import { SecurityReport } from './security-report';
import { normalizeTags } from '@/lib/vault/items';
import { ShieldCheck } from 'lucide-react';

const SEARCH_INPUT_ID = 'vaulty-search';

interface VaultAppProps {
  onLock: () => void;
  onSignOut: () => void;
}

export function VaultApp(props: VaultAppProps) {
  const { key } = useVaultKey();
  // The shell guarantees the vault is unlocked before rendering this; the guard
  // is here only so the key is non-null for the inner component.
  if (!key) return null;
  return <VaultAppInner cryptoKey={key} {...props} />;
}

function VaultAppInner({
  cryptoKey,
  onLock,
  onSignOut,
}: { cryptoKey: CryptoKey } & VaultAppProps) {
  const { items, loading, error, createItem, updateItem, deleteItem } =
    useVaultItems(cryptoKey);
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState<'vault' | 'trash'>('vault');
  const [reportOpen, setReportOpen] = useState(false);

  // Split active vs trashed once so both views work off the same source.
  const activeItems = useMemo(() => items.filter((i) => !isDeleted(i)), [items]);
  const trashedItems = useMemo(() => items.filter(isDeleted), [items]);
  const viewItems = view === 'trash' ? trashedItems : activeItems;

  const allTags = useMemo(() => collectTags(viewItems), [viewItems]);

  // Derive an "effective" active tag so a stale selection (tag removed from
  // every item after an edit) simply falls back to "All" without a setState.
  const effectiveTag =
    activeTag && allTags.some((t) => t.toLowerCase() === activeTag.toLowerCase())
      ? activeTag
      : null;

  const filtered = useMemo(() => {
    const scoped = effectiveTag
      ? viewItems.filter((i) =>
          getTags(i).some((t) => t.toLowerCase() === effectiveTag.toLowerCase()),
        )
      : viewItems;
    const matched = filterItems(scoped, query);
    // With no query, hoist favorites to the top while preserving each half's
    // existing (updatedAt-desc) ordering. When a query is present, keep the
    // relevance ranking from filterItems intact.
    if (query.trim()) return matched;
    const favs = matched.filter(isFavorite);
    const rest = matched.filter((i) => !isFavorite(i));
    return [...favs, ...rest];
  }, [viewItems, query, effectiveTag]);

  async function handleToggleFavorite(item: VaultItem) {
    const nextFields = { ...item.fields, favorite: !isFavorite(item) };
    await updateItem(item.id, item.type, nextFields as ItemFields);
  }

  function toggleSelect(item: VaultItem) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    const targets = items.filter((i) => selectedIds.has(i.id));
    // Sequentially so a partial failure still reflects earlier successes.
    for (const item of targets) {
      if (view === 'trash') {
        await deleteItem(item.id);
      } else {
        const nextFields = {
          ...item.fields,
          deletedAt: new Date().toISOString(),
        };
        await updateItem(item.id, item.type, nextFields as ItemFields);
      }
    }
    clearSelection();
  }

  async function handleBulkRestore() {
    const targets = items.filter((i) => selectedIds.has(i.id));
    for (const item of targets) {
      const nextFields = { ...item.fields };
      delete nextFields.deletedAt;
      await updateItem(item.id, item.type, nextFields as ItemFields);
    }
    clearSelection();
  }

  async function handleBulkAddTags(newTags: string[]) {
    const targets = items.filter((i) => selectedIds.has(i.id));
    for (const item of targets) {
      const merged = normalizeTags([...getTags(item), ...newTags]);
      await updateItem(item.id, item.type, {
        ...item.fields,
        tags: merged,
      } as ItemFields);
    }
    clearSelection();
  }

  // Global keyboard shortcuts. Anything without a modifier is ignored while
  // the user is typing in an input, textarea, or contenteditable so it never
  // steals a keystroke that was meant for the field.
  useEffect(() => {
    function isTypingContext(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }

    function focusSearch() {
      const el = document.getElementById(SEARCH_INPUT_ID);
      if (el instanceof HTMLInputElement) {
        el.focus();
        el.select();
      }
    }

    function onKey(e: KeyboardEvent) {
      const hasMod = e.metaKey || e.ctrlKey;
      const key = e.key;

      // Cmd/Ctrl+K — command palette (also works while typing).
      if (hasMod && key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      // Cmd/Ctrl+L — lock the vault (also works while typing).
      if (hasMod && key.toLowerCase() === 'l') {
        e.preventDefault();
        onLock();
        return;
      }

      if (isTypingContext(e.target)) return;

      // Bare-key shortcuts only fire outside inputs.
      if (key === '/') {
        e.preventDefault();
        focusSearch();
      } else if (key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (key === 'n' && !e.shiftKey) {
        e.preventDefault();
        setEditing({ type: 'login' });
      } else if (key === 'N' && e.shiftKey) {
        e.preventDefault();
        setEditing({ type: 'note' });
      } else if (key === 'Escape') {
        // ESC clears the current bulk selection (dialogs handle their own ESC).
        setSelectedIds((prev) => (prev.size > 0 ? new Set() : prev));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onLock]);

  async function handleSave(type: ItemType, fields: ItemFields, id?: string) {
    if (id) await updateItem(id, type, fields);
    else await createItem(type, fields);
    setEditing(null);
  }

  // In the main vault, "delete" is a soft delete: the item moves to the trash
  // view. In the trash view, "delete" is permanent. Restore removes the
  // deletedAt stamp and returns the item to the main vault.
  async function handleDelete(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (isDeleted(item)) {
      await deleteItem(id);
    } else {
      const nextFields = { ...item.fields, deletedAt: new Date().toISOString() };
      await updateItem(id, item.type, nextFields as ItemFields);
    }
    setEditing(null);
  }

  async function handleRestore(item: VaultItem) {
    const nextFields = { ...item.fields };
    delete nextFields.deletedAt;
    await updateItem(item.id, item.type, nextFields as ItemFields);
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          {view === 'trash' ? 'Trash' : 'Your vault'}
          {viewItems.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {viewItems.length} item{viewItems.length === 1 ? '' : 's'}
            </span>
          )}
        </h1>
        <div className="flex gap-2">
          {view === 'vault' ? (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setReportOpen(true)}
                aria-label="Security report"
                title="Security report"
              >
                <ShieldCheck />
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditing({ type: 'login' })}
              >
                <KeyRound /> Add login
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditing({ type: 'note' })}
              >
                <StickyNote /> Add note
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setView('vault')}>
              Back to vault
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-1 border-b">
        <ViewTab
          label={`Vault${activeItems.length > 0 ? ` (${activeItems.length})` : ''}`}
          active={view === 'vault'}
          onClick={() => {
            setView('vault');
            clearSelection();
          }}
        />
        <ViewTab
          label={`Trash${trashedItems.length > 0 ? ` (${trashedItems.length})` : ''}`}
          active={view === 'trash'}
          onClick={() => {
            setView('trash');
            clearSelection();
          }}
        />
      </div>

      {error && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Decrypting your vault...</p>
      ) : viewItems.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            {view === 'trash'
              ? 'Trash is empty. Deleted items appear here.'
              : items.length === 0
                ? 'Your vault is empty. Add your first login or secure note.'
                : 'Nothing here. Everything in your vault is active.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={SEARCH_INPUT_ID}
              type="search"
              placeholder="Search (press / to focus)"
              aria-label="Search items"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          {allTags.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Filter by tag"
            >
              <button
                type="button"
                onClick={() => setActiveTag(null)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  effectiveTag === null
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                All
              </button>
              {allTags.map((tag) => {
                const active = effectiveTag?.toLowerCase() === tag.toLowerCase();
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setActiveTag(active ? null : tag)}
                    aria-pressed={active}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No matches for &ldquo;{query}&rdquo;
              </p>
            </div>
          ) : (
            <ItemList
              items={filtered}
              onOpen={(item) => setEditing({ type: item.type, item })}
              onToggleFavorite={handleToggleFavorite}
              onRestore={view === 'trash' ? handleRestore : undefined}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          )}
        </div>
      )}

      <ItemDialog
        editing={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={activeItems}
        onSelectItem={(item) => setEditing({ type: item.type, item })}
        onNewLogin={() => setEditing({ type: 'login' })}
        onNewNote={() => setEditing({ type: 'note' })}
        onLock={onLock}
        onSignOut={onSignOut}
      />

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      <BulkActionBar
        count={selectedIds.size}
        onClear={clearSelection}
        onAddTags={view === 'trash' ? undefined : handleBulkAddTags}
        onRestore={view === 'trash' ? handleBulkRestore : undefined}
        onDelete={handleBulkDelete}
        deleteLabel={view === 'trash' ? 'Delete forever' : 'Delete'}
      />

      <SecurityReport
        open={reportOpen}
        onOpenChange={setReportOpen}
        items={activeItems}
        onOpenItem={(item) => setEditing({ type: item.type, item })}
      />
    </main>
  );
}

function ViewTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}
