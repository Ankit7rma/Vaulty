'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  KeyRound,
  Lock,
  LogOut,
  Moon,
  Search,
  StickyNote,
  Sun,
  Monitor,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { filterItems, type VaultItem } from '@/lib/vault/items';
import { useTheme } from '@/components/theme-provider';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: VaultItem[];
  onSelectItem: (item: VaultItem) => void;
  onNewLogin: () => void;
  onNewNote: () => void;
  onLock: () => void;
  onSignOut: () => void;
  onPanicWipe: () => void;
}

type ActionEntry = {
  kind: 'action';
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
};

type ItemEntry = {
  kind: 'item';
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
};

type Entry = ActionEntry | ItemEntry;

const ITEM_LIMIT = 8;

export function CommandPalette(props: CommandPaletteProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[70svh] flex-col gap-0 p-0 sm:max-w-lg"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>Search actions and vault items.</DialogDescription>
        </DialogHeader>
        {props.open && <PaletteBody {...props} />}
      </DialogContent>
    </Dialog>
  );
}

// Body is a separate component so state naturally resets each time the
// palette opens: it mounts on open, unmounts on close.
function PaletteBody({
  onOpenChange,
  items,
  onSelectItem,
  onNewLogin,
  onNewNote,
  onLock,
  onSignOut,
  onPanicWipe,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const inputId = useId();
  const { preference: themePreference, setPreference: setThemePreference } =
    useTheme();

  // Base UI focuses the popup itself; hand focus to the search input on mount.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(inputId);
      if (el instanceof HTMLInputElement) el.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [inputId]);

  const actions = useMemo<ActionEntry[]>(() => {
    const nextThemeLabel: Record<typeof themePreference, string> = {
      system: 'Switch to light theme',
      light: 'Switch to dark theme',
      dark: 'Follow system theme',
    };
    const nextThemeIcon: Record<typeof themePreference, React.ReactNode> = {
      system: <Sun className="size-4" aria-hidden />,
      light: <Moon className="size-4" aria-hidden />,
      dark: <Monitor className="size-4" aria-hidden />,
    };
    return [
      {
        kind: 'action',
        id: 'new-login',
        label: 'New login',
        hint: 'Add a saved credential',
        icon: <KeyRound className="size-4" aria-hidden />,
        run: onNewLogin,
      },
      {
        kind: 'action',
        id: 'new-note',
        label: 'New secure note',
        hint: 'Add an encrypted note',
        icon: <StickyNote className="size-4" aria-hidden />,
        run: onNewNote,
      },
      {
        kind: 'action',
        id: 'toggle-theme',
        label: nextThemeLabel[themePreference],
        icon: nextThemeIcon[themePreference],
        run: () => {
          const next =
            themePreference === 'system'
              ? 'light'
              : themePreference === 'light'
                ? 'dark'
                : 'system';
          setThemePreference(next);
        },
      },
      {
        kind: 'action',
        id: 'lock',
        label: 'Lock vault',
        hint: 'Wipe the in-memory key',
        icon: <Lock className="size-4" aria-hidden />,
        run: onLock,
      },
      {
        kind: 'action',
        id: 'sign-out',
        label: 'Sign out',
        icon: <LogOut className="size-4" aria-hidden />,
        run: onSignOut,
      },
      {
        kind: 'action',
        id: 'panic-wipe',
        label: 'Panic wipe',
        hint: 'Lock + clear clipboard + sign out',
        icon: <AlertTriangle className="size-4" aria-hidden />,
        run: onPanicWipe,
      },
    ];
  }, [
    onNewLogin,
    onNewNote,
    onLock,
    onSignOut,
    onPanicWipe,
    themePreference,
    setThemePreference,
  ]);

  const q = query.trim().toLowerCase();

  const shownActions = useMemo(
    () =>
      q
        ? actions.filter((a) => a.label.toLowerCase().includes(q))
        : actions,
    [actions, q],
  );

  const shownItems = useMemo<ItemEntry[]>(() => {
    const matches = q ? filterItems(items, query) : items;
    return matches.slice(0, ITEM_LIMIT).map((item) => ({
      kind: 'item',
      id: item.id,
      label: item.fields.title || '(untitled)',
      hint:
        item.type === 'login' && item.fields.username
          ? item.fields.username
          : item.type === 'login'
            ? 'Login'
            : 'Secure note',
      icon:
        item.type === 'login' ? (
          <KeyRound className="size-4" aria-hidden />
        ) : (
          <StickyNote className="size-4" aria-hidden />
        ),
      run: () => onSelectItem(item),
    }));
  }, [items, query, q, onSelectItem]);

  const entries = useMemo<Entry[]>(
    () => [...shownActions, ...shownItems],
    [shownActions, shownItems],
  );

  // Derive the active index instead of storing a stale one so we never point
  // past the end when results shrink.
  const activeIndex =
    entries.length === 0 ? 0 : Math.min(selectedIndex, entries.length - 1);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function runEntry(entry: Entry | undefined) {
    if (!entry) return;
    onOpenChange(false);
    // Defer so the dialog can close before the action fires (avoids fighting
    // focus with any dialog the action might open).
    setTimeout(entry.run, 0);
  }

  return (
    <>
      <div className="relative border-b p-3">
        <Search
          className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={inputId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type an action or search your vault..."
          aria-label="Command"
          className="h-10 border-none pl-8 shadow-none focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelectedIndex((i) => Math.min(entries.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelectedIndex((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              runEntry(entries[activeIndex]);
            }
          }}
        />
      </div>

      {entries.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          {items.length === 0
            ? 'Your vault is empty. Try "New login".'
            : `No matches for “${query}”`}
        </div>
      ) : (
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Palette results"
          className="max-h-96 overflow-y-auto p-1.5"
        >
          {shownActions.length > 0 && (
            <li className="px-2 pt-1.5 pb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Actions
            </li>
          )}
          {shownActions.map((entry, i) => (
            <PaletteRow
              key={entry.id}
              entry={entry}
              index={i}
              selected={activeIndex === i}
              onSelect={runEntry}
              onHover={setSelectedIndex}
            />
          ))}

          {shownItems.length > 0 && (
            <li className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Items
            </li>
          )}
          {shownItems.map((entry, i) => {
            const idx = shownActions.length + i;
            return (
              <PaletteRow
                key={entry.id}
                entry={entry}
                index={idx}
                selected={activeIndex === idx}
                onSelect={runEntry}
                onHover={setSelectedIndex}
              />
            );
          })}
        </ul>
      )}

      <div className="border-t bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
        <kbd className="rounded border px-1">↑</kbd>
        <kbd className="ml-1 rounded border px-1">↓</kbd> to navigate ·{' '}
        <kbd className="rounded border px-1">↵</kbd> to select ·{' '}
        <kbd className="rounded border px-1">esc</kbd> to close
      </div>
    </>
  );
}

function PaletteRow({
  entry,
  index,
  selected,
  onSelect,
  onHover,
}: {
  entry: Entry;
  index: number;
  selected: boolean;
  onSelect: (entry: Entry) => void;
  onHover: (index: number) => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        data-index={index}
        onClick={() => onSelect(entry)}
        onMouseEnter={() => onHover(index)}
        className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm outline-none ${
          selected ? 'bg-accent text-accent-foreground' : ''
        }`}
      >
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-md ${
            selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
          }`}
        >
          {entry.icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{entry.label}</span>
        {entry.hint && (
          <span className="truncate text-xs text-muted-foreground">
            {entry.hint}
          </span>
        )}
      </button>
    </li>
  );
}
