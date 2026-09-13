'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const isMac =
  typeof navigator !== 'undefined' && /Mac|iP(hone|od|ad)/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: [mod, 'K'], label: 'Open command palette' },
  { keys: ['N'], label: 'New login' },
  { keys: ['Shift', 'N'], label: 'New secure note' },
  { keys: [mod, 'L'], label: 'Lock vault' },
  { keys: ['/'], label: 'Focus search' },
  { keys: ['?'], label: 'Show this help' },
  { keys: ['Esc'], label: 'Close a dialog' },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts are ignored while typing in an input.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1.5">
          {SHORTCUTS.map(({ keys, label }) => (
            <li
              key={label}
              className="flex items-center justify-between gap-4 rounded-md px-1 py-1 text-sm"
            >
              <span className="text-foreground/90">{label}</span>
              <span className="flex gap-1">
                {keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
