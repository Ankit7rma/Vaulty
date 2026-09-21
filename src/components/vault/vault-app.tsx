'use client';

import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Search, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVaultKey } from '@/lib/vault/vault-key-context';
import { useVaultItems } from '@/lib/vault/use-vault-items';
import type { VaultScope } from './vault-switcher';
import type {
  SharedVaultSummary,
  UseSharedVaults,
} from '@/lib/vault/use-shared-vaults';
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
import { TemplatePicker } from './template-picker';
import {
  ChangelogDialog,
  useChangelogHasUpdates,
} from './changelog-dialog';
import { OnboardingTour, useTourCompleted } from './onboarding-tour';
import { ExportDialog } from './export-dialog';
import { ImportDialog } from './import-dialog';
import { SentSharesDialog } from './sent-shares-dialog';
import { MembersDialog } from './members-dialog';
import { normalizeTags } from '@/lib/vault/items';
import {
  Download,
  LayoutTemplate,
  Share2,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';

const SEARCH_INPUT_ID = 'vaulty-search';

interface VaultAppProps {
  scope: VaultScope;
  sharedVaults: UseSharedVaults;
  onLock: () => void;
  onSignOut: () => void;
  onPanicWipe: () => void;
}

export function VaultApp(props: VaultAppProps) {
  const { key } = useVaultKey();
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
  const [sharedVault, setSharedVault] = useState<SharedVaultSummary | null>(null);

  // When scope is a shared vault, unwrap its symmetric key with the caller's
  // private key. Cached inside useSharedVaults so switching between vaults
  // that have already been unlocked once is instant.
  const scopeId = props.scope.kind === 'shared' ? props.scope.id : null;
  const targetVault = scopeId
    ? (props.sharedVaults.vaults.find((v) => v.id === scopeId) ?? null)
    : null;
  const getVaultKey = props.sharedVaults.getVaultKey;
  useEffect(() => {
    if (!targetVault) return;
    let cancelled = false;
    getVaultKey(targetVault)
      .then((k) => {
        if (cancelled) return;
        setSharedKey(k);
        setSharedVault(targetVault);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [targetVault, getVaultKey]);

  if (!key) return null;
  if (props.scope.kind === 'shared') {
    // Guard against a stale unwrap: if the effect above hasn't caught up with
    // the current scope yet, sharedVault.id will lag behind, so show loading.
    if (!sharedKey || !sharedVault || sharedVault.id !== props.scope.id) {
      return (
        <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8 text-sm text-muted-foreground">
          Unlocking shared vault...
        </main>
      );
    }
    return (
      <VaultAppInner
        cryptoKey={sharedKey}
        sharedVaultId={sharedVault.id}
        sharedVault={sharedVault}
        writable={sharedVault.role !== 'reader'}
        {...props}
      />
    );
  }
  return <VaultAppInner cryptoKey={key} {...props} />;
}

function VaultAppInner({
  cryptoKey,
  sharedVaultId,
  sharedVault,
  writable = true,
  sharedVaults,
  onLock,
  onSignOut,
  onPanicWipe,
}: {
  cryptoKey: CryptoKey;
  sharedVaultId?: string;
  sharedVault?: SharedVaultSummary;
  writable?: boolean;
} & VaultAppProps) {
  const [membersOpen, setMembersOpen] = useState(false);
  const { items, loading, error, createItem, updateItem, deleteItem } =
    useVaultItems(cryptoKey, sharedVaultId);
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState<'vault' | 'trash'>('vault');
  const [reportOpen, setReportOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sharesOpen, setSharesOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const changelogHasUpdates = useChangelogHasUpdates();
  const tourCompleted = useTourCompleted();
  // "manual" is set true if the user re-opens the tour after dismissing it;
  // "dismissed" is set when they close the auto-opened tour in this session.
  // We derive `tourOpen` from these plus the persisted completion flag so we
  // never need a setState-in-effect to reflect storage into state.
  const [tourDismissedThisSession, setTourDismissedThisSession] =
    useState(false);
  const [tourManualOpen, setTourManualOpen] = useState(false);
  const tourOpen =
    tourManualOpen || (!tourCompleted && !tourDismissedThisSession);

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
                onClick={() => setChangelogOpen(true)}
                aria-label={
                  changelogHasUpdates
                    ? "What's new (updates available)"
                    : "What's new"
                }
                title="What's new"
                className="relative"
              >
                <Sparkles />
                {changelogHasUpdates && (
                  <span
                    aria-hidden
                    className="absolute top-1 right-1 size-1.5 rounded-full bg-primary"
                  />
                )}
              </Button>
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
                size="icon"
                onClick={() => setTemplatesOpen(true)}
                aria-label="New item from template"
                title="New item from template"
              >
                <LayoutTemplate />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setExportOpen(true)}
                aria-label="Export vault"
                title="Export vault"
              >
                <Download />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setImportOpen(true)}
                aria-label="Import items"
                title="Import items"
              >
                <Upload />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSharesOpen(true)}
                aria-label="Sent shares"
                title="Sent shares"
              >
                <Share2 />
              </Button>
              {sharedVault && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setMembersOpen(true)}
                  aria-label="Members"
                  title="Members"
                >
                  <Users />
                </Button>
              )}
              {writable && (
                <>
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
              )}
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
        onPanicWipe={onPanicWipe}
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

      <TemplatePicker
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onPick={(template) =>
          setEditing({ type: template.type, preset: template.fields })
        }
      />

      <ChangelogDialog
        open={changelogOpen}
        onOpenChange={setChangelogOpen}
      />

      <OnboardingTour
        open={tourOpen}
        onOpenChange={(v) => {
          if (v) setTourManualOpen(true);
          else {
            setTourManualOpen(false);
            setTourDismissedThisSession(true);
          }
        }}
      />

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        items={activeItems}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={async (parsed) => {
          // Import sequentially so a partial failure leaves earlier successes.
          for (const p of parsed) {
            await createItem(p.type, p.fields);
          }
        }}
      />

      <SentSharesDialog open={sharesOpen} onOpenChange={setSharesOpen} />

      {sharedVault && sharedVaults.keypair && (
        <MembersDialog
          open={membersOpen}
          onOpenChange={setMembersOpen}
          vault={sharedVault}
          privateKey={sharedVaults.keypair.privateKey}
        />
      )}
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
