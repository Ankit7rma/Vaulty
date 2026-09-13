'use client';

import { useState } from 'react';
import { Loader2, Tag, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TagInput } from './tag-input';

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  onAddTags: (tags: string[]) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function BulkActionBar({
  count,
  onClear,
  onAddTags,
  onDelete,
}: BulkActionBarProps) {
  const [tagOpen, setTagOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (count === 0) return null;

  async function runAddTags() {
    if (pendingTags.length === 0) {
      setTagOpen(false);
      return;
    }
    setBusy(true);
    try {
      await onAddTags(pendingTags);
      setPendingTags([]);
      setTagOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function runDelete() {
    setBusy(true);
    try {
      await onDelete();
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label="Bulk actions"
        className="fixed inset-x-0 bottom-4 z-30 mx-auto flex w-fit items-center gap-2 rounded-full border bg-popover px-2 py-1.5 shadow-lg"
      >
        <span className="px-2 text-sm font-medium">
          {count} selected
        </span>
        <div className="h-4 w-px bg-border" aria-hidden />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setTagOpen(true)}
          className="gap-1.5"
        >
          <Tag className="size-3.5" aria-hidden /> Add tag
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={() => setDeleteOpen(true)}
          className="gap-1.5"
        >
          <Trash2 className="size-3.5" aria-hidden /> Delete
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={onClear}
          aria-label="Clear selection"
          title="Clear selection"
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <Dialog open={tagOpen} onOpenChange={setTagOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add tags to {count} items</DialogTitle>
            <DialogDescription>
              Existing tags on each item are preserved.
            </DialogDescription>
          </DialogHeader>
          <TagInput value={pendingTags} onChange={setPendingTags} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTagOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={runAddTags}
              disabled={busy || pendingTags.length === 0}
              className="gap-1.5"
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {count} items?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Encrypted rows will be removed from the
              server.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={runDelete}
              disabled={busy}
              className="gap-1.5"
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
