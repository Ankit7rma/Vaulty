'use client';

import { useState } from 'react';
import { ChevronDown, Loader2, Plus, User as UserIcon, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { SharedVaultSummary } from '@/lib/vault/use-shared-vaults';

/**
 * Compact picker for the personal vault + every shared vault the caller
 * belongs to. Shown in the header so it's always one click away. Falls
 * back to a plain "Personal" label with no dropdown when the caller has
 * no shared vaults yet — nothing to switch between.
 */

export type VaultScope = { kind: 'personal' } | { kind: 'shared'; id: string };

interface Props {
  active: VaultScope;
  vaults: SharedVaultSummary[];
  loading: boolean;
  onSelect: (scope: VaultScope) => void;
  onCreate: () => void;
}

function scopeLabel(active: VaultScope, vaults: SharedVaultSummary[]): string {
  if (active.kind === 'personal') return 'Personal';
  return vaults.find((v) => v.id === active.id)?.displayName ?? 'Shared vault';
}

export function VaultSwitcher({ active, vaults, loading, onSelect, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5 h-8">
            {active.kind === 'personal' ? (
              <UserIcon className="size-3.5" aria-hidden />
            ) : (
              <Users className="size-3.5" aria-hidden />
            )}
            <span className="max-w-[10rem] truncate text-sm">
              {scopeLabel(active, vaults)}
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
          </Button>
        }
      />
      <PopoverContent className="w-72 p-1" align="start">
        <ul className="max-h-[60vh] overflow-y-auto">
          <li>
            <button
              type="button"
              onClick={() => {
                onSelect({ kind: 'personal' });
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted ${
                active.kind === 'personal' ? 'bg-muted font-medium' : ''
              }`}
            >
              <UserIcon className="size-4 text-muted-foreground" aria-hidden />
              Personal
            </button>
          </li>
          {vaults.length > 0 && (
            <li
              className="mt-1 border-t px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              Shared
            </li>
          )}
          {vaults.map((v) => {
            const isActive = active.kind === 'shared' && active.id === v.id;
            return (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect({ kind: 'shared', id: v.id });
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted ${
                    isActive ? 'bg-muted font-medium' : ''
                  }`}
                >
                  <Users className="size-4 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {v.displayName ?? '(locked)'}
                  </span>
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {v.role}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {loading && (
          <p className="flex items-center gap-2 border-t px-2 py-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            Loading shared vaults...
          </p>
        )}
        <div className="border-t p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => {
              onCreate();
              setOpen(false);
            }}
          >
            <Plus className="size-4" aria-hidden />
            New shared vault
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
