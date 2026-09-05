'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useSettings } from '@/lib/settings/settings-context';
import { AUTO_LOCK_OPTIONS, CLIPBOARD_OPTIONS } from '@/lib/settings/settings';

const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const { autoLockMinutes, clipboardClearSeconds, update } = useSettings();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            title="Settings"
          >
            <Settings />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Saved on this device.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="autolock">Auto-lock after inactivity</Label>
            <select
              id="autolock"
              className={SELECT_CLASS}
              value={autoLockMinutes}
              onChange={(e) => update({ autoLockMinutes: Number(e.target.value) })}
            >
              {AUTO_LOCK_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? 'Never' : `${m} minute${m === 1 ? '' : 's'}`}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="clipboard">Clear clipboard after copying</Label>
            <select
              id="clipboard"
              className={SELECT_CLASS}
              value={clipboardClearSeconds}
              onChange={(e) =>
                update({ clipboardClearSeconds: Number(e.target.value) })
              }
            >
              {CLIPBOARD_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === 0 ? 'Never' : `${s} seconds`}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
