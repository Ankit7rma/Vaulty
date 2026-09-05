'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ItemForm } from './item-form';
import type { ItemFields, ItemType, VaultItem } from '@/lib/vault/items';

export interface EditingItem {
  type: ItemType;
  item?: VaultItem;
}

function heading(editing: EditingItem): string {
  const noun = editing.type === 'login' ? 'login' : 'note';
  return editing.item ? `Edit ${noun}` : `New ${noun}`;
}

export function ItemDialog({
  editing,
  onClose,
  onSave,
  onDelete,
}: {
  editing: EditingItem | null;
  onClose: () => void;
  onSave: (type: ItemType, fields: ItemFields, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <Dialog
      open={editing !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        {editing && (
          <>
            <DialogHeader>
              <DialogTitle>{heading(editing)}</DialogTitle>
              <DialogDescription>
                Everything is encrypted in your browser before it is saved.
              </DialogDescription>
            </DialogHeader>
            {/* Remount on target change so the form resets its state. */}
            <ItemForm
              key={editing.item?.id ?? `new-${editing.type}`}
              type={editing.type}
              item={editing.item}
              onSave={onSave}
              onDelete={onDelete}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
