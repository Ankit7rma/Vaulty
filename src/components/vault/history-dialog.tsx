'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bookmark, Clock, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  decryptRecord,
  type ItemFields,
  type ItemRecord,
  type VaultItem,
} from '@/lib/vault/items';
import { useVaultKey } from '@/lib/vault/vault-key-context';
import {
  decryptString,
  encryptString,
  type EncryptedBlob,
} from '@/lib/crypto';

interface HistoryVersion {
  id: string;
  savedAt: string;
  item: VaultItem;
  pinned: boolean;
  label: string | null;
}

interface HistoryRow extends ItemRecord {
  savedAt: string;
  pinned: boolean;
  label: string | null;
  labelIv: string | null;
}

async function fetchHistory(
  itemId: string,
  key: CryptoKey,
): Promise<HistoryVersion[]> {
  const res = await fetch(`/api/vault/items/${itemId}/history`);
  if (!res.ok) throw new Error('history fetch failed');
  const data = (await res.json()) as { versions: HistoryRow[] };
  return Promise.all(
    data.versions.map(async (v) => {
      const item = await decryptRecord(key, {
        id: v.id,
        type: v.type,
        cipher: v.cipher,
        iv: v.iv,
        createdAt: v.savedAt,
        updatedAt: v.savedAt,
      });
      let label: string | null = null;
      if (v.label && v.labelIv) {
        try {
          label = await decryptString(key, { cipher: v.label, iv: v.labelIv });
        } catch {
          // Corrupt or wrong-key label: fall back to showing the timestamp.
        }
      }
      return {
        id: v.id,
        savedAt: v.savedAt,
        item,
        pinned: v.pinned,
        label,
      };
    }),
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
            Save a checkpoint to keep a version pinned across future edits.
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  const reload = useCallback(async () => {
    if (!key) return;
    try {
      const v = await fetchHistory(itemId, key);
      setVersions(v);
    } catch {
      setError('Could not load history.');
    }
  }, [itemId, key]);

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

  async function saveCheckpoint() {
    if (!key) return;
    setSavingPin(true);
    try {
      let payload: { label?: string; labelIv?: string } = {};
      const trimmed = labelDraft.trim();
      if (trimmed.length > 0) {
        const blob: EncryptedBlob = await encryptString(key, trimmed);
        payload = { label: blob.cipher, labelIv: blob.iv };
      }
      const res = await fetch(`/api/vault/items/${itemId}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError('Could not save checkpoint.');
        return;
      }
      setSaveOpen(false);
      setLabelDraft('');
      await reload();
    } finally {
      setSavingPin(false);
    }
  }

  async function deletePinned(version: HistoryVersion) {
    setDeletingId(version.id);
    try {
      const res = await fetch(
        `/api/vault/items/${itemId}/history/${version.id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        setError('Could not delete checkpoint.');
        return;
      }
      await reload();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b p-3">
        {saveOpen ? (
          <div className="flex w-full items-center gap-2">
            <Input
              placeholder="Checkpoint label (optional)"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              disabled={savingPin}
              autoFocus
              maxLength={80}
              className="h-8 text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setSaveOpen(false);
                setLabelDraft('');
              }}
              disabled={savingPin}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveCheckpoint}
              disabled={savingPin}
              className="gap-1.5"
            >
              {savingPin && (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              )}
              Save
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Auto snapshots roll off after 10 edits. Checkpoints stay pinned.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSaveOpen(true)}
              className="gap-1.5"
            >
              <Bookmark className="size-3.5" aria-hidden />
              Save version
            </Button>
          </>
        )}
      </div>
      {error && (
        <p className="border-b bg-destructive/8 p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {!versions ? (
        <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading previous
          versions...
        </p>
      ) : versions.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          No previous versions yet. Save a checkpoint above to keep the current
          state, or just edit the item and history will record each save.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
          {versions.map((v) => (
            <li key={v.id} className="flex items-start gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {v.pinned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-500">
                      <Bookmark className="size-3" aria-hidden />
                      Checkpoint
                    </span>
                  )}
                  <span>{formatWhen(v.savedAt)}</span>
                </p>
                {v.label && (
                  <p className="mt-0.5 truncate text-sm font-medium">
                    {v.label}
                  </p>
                )}
                <p
                  className={`${
                    v.label ? 'mt-0.5 text-xs text-muted-foreground' : 'mt-0.5 text-sm font-medium'
                  } truncate`}
                >
                  {summarize(v.item)}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => restore(v)}
                  disabled={restoringId !== null || deletingId !== null}
                  className="gap-1.5"
                >
                  {restoringId === v.id ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <RotateCcw className="size-3.5" aria-hidden />
                  )}
                  Restore
                </Button>
                {v.pinned && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => deletePinned(v)}
                    disabled={deletingId !== null || restoringId !== null}
                    aria-label="Delete checkpoint"
                    title="Delete checkpoint"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {deletingId === v.id ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="size-3.5" aria-hidden />
                    )}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
