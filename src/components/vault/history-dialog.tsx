'use client';

import { useEffect, useState } from 'react';
import { Clock, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { decryptRecord, type ItemFields, type ItemRecord, type VaultItem } from '@/lib/vault/items';
import { useVaultKey } from '@/lib/vault/vault-key-context';

interface HistoryVersion {
  id: string;
  savedAt: string;
  item: VaultItem;
}

async function fetchHistory(
  itemId: string,
  key: CryptoKey,
): Promise<HistoryVersion[]> {
  const res = await fetch(`/api/vault/items/${itemId}/history`);
  if (!res.ok) throw new Error('history fetch failed');
  const data = (await res.json()) as {
    versions: Array<ItemRecord & { savedAt: string }>;
  };
  return Promise.all(
    data.versions.map(async (v) => ({
      id: v.id,
      savedAt: v.savedAt,
      item: await decryptRecord(key, {
        id: v.id,
        type: v.type,
        cipher: v.cipher,
        iv: v.iv,
        createdAt: v.savedAt,
        updatedAt: v.savedAt,
      }),
    })),
  );
}

function formatWhen(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function summarize(item: VaultItem): string {
  if (item.type === 'login') {
    const parts = [item.fields.title || 'Untitled', item.fields.username]
      .filter(Boolean)
      .join(' - ');
    return parts;
  }
  return item.fields.title || 'Untitled note';
}

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  onRestore: (fields: ItemFields) => Promise<void>;
}

export function HistoryDialog({
  open,
  onOpenChange,
  itemId,
  onRestore,
}: HistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[70svh] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" aria-hidden />
            Item history
          </DialogTitle>
          <DialogDescription>
            Previous versions decrypt in your browser with the current vault key.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <HistoryBody
            itemId={itemId}
            onRestore={async (fields) => {
              await onRestore(fields);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function HistoryBody({
  itemId,
  onRestore,
}: {
  itemId: string;
  onRestore: (fields: ItemFields) => Promise<void>;
}) {
  const { key } = useVaultKey();
  const [versions, setVersions] = useState<HistoryVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    fetchHistory(itemId, key)
      .then((v) => !cancelled && setVersions(v))
      .catch(() => !cancelled && setError('Could not load history.'));
    return () => {
      cancelled = true;
    };
  }, [itemId, key]);

  async function restore(version: HistoryVersion) {
    setRestoringId(version.id);
    try {
      await onRestore(version.item.fields);
    } finally {
      setRestoringId(null);
    }
  }

  if (error) {
    return (
      <p className="p-4 text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }
  if (!versions) {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading previous
        versions...
      </p>
    );
  }
  if (versions.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No previous versions yet. History records every save.
      </p>
    );
  }

  return (
    <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
      {versions.map((v) => (
        <li key={v.id} className="flex items-start gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {formatWhen(v.savedAt)}
            </p>
            <p className="mt-0.5 truncate text-sm font-medium">
              {summarize(v.item)}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => restore(v)}
            disabled={restoringId !== null}
            className="gap-1.5"
          >
            {restoringId === v.id ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RotateCcw className="size-3.5" aria-hidden />
            )}
            Restore
          </Button>
        </li>
      ))}
    </ul>
  );
}
