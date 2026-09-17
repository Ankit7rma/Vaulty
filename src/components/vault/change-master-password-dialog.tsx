'use client';

import { useState } from 'react';
import { AlertCircle, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useVaultKey } from '@/lib/vault/vault-key-context';
import {
  deriveAndVerify,
  enrollMasterKey,
  type KeyDescriptor,
} from '@/lib/vault/master-key';
import { encryptJson, decryptJson } from '@/lib/crypto';
import type { ItemRecord } from '@/lib/vault/items';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeMasterPasswordDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" aria-hidden />
            Change master password
          </DialogTitle>
          <DialogDescription>
            Every item is re-encrypted in the browser under the new key. Your
            current and new master passwords never leave this device.
          </DialogDescription>
        </DialogHeader>
        {open && <Body onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

type Stage =
  | 'idle'
  | 'verifying'
  | 'deriving'
  | 'reencrypting'
  | 'uploading'
  | 'done';

function stageLabel(stage: Stage): string {
  switch (stage) {
    case 'verifying':
      return 'Checking your current master password...';
    case 'deriving':
      return 'Deriving the new key...';
    case 'reencrypting':
      return 'Re-encrypting your vault items...';
    case 'uploading':
      return 'Saving the new key...';
    default:
      return '';
  }
}

function Body({ onDone }: { onDone: () => void }) {
  const { unlock } = useVaultKey();
  const [accountPassword, setAccountPassword] = useState('');
  const [currentMaster, setCurrentMaster] = useState('');
  const [newMaster, setNewMaster] = useState('');
  const [confirmMaster, setConfirmMaster] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const busy = stage !== 'idle' && stage !== 'done';
  const canSubmit =
    !busy &&
    accountPassword.length > 0 &&
    currentMaster.length > 0 &&
    newMaster.length >= 8 &&
    newMaster === confirmMaster &&
    newMaster !== currentMaster;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);

    try {
      setStage('verifying');
      const paramsRes = await fetch('/api/vault/keyparams', { cache: 'no-store' });
      if (!paramsRes.ok) throw new Error('Could not load your key parameters.');
      const descriptor = (await paramsRes.json()) as KeyDescriptor;
      const oldKey = await deriveAndVerify(currentMaster, descriptor);
      if (!oldKey) {
        setError('Current master password is incorrect.');
        setStage('idle');
        return;
      }

      setStage('deriving');
      const { key: newKey, descriptor: newDescriptor } =
        await enrollMasterKey(newMaster);

      setStage('reencrypting');
      const itemsRes = await fetch('/api/vault/items', { cache: 'no-store' });
      if (!itemsRes.ok) throw new Error('Could not load your vault items.');
      const { items } = (await itemsRes.json()) as { items: ItemRecord[] };
      setProgress({ done: 0, total: items.length });

      const rewrapped: Array<{ id: string; cipher: string; iv: string }> = [];
      for (const record of items) {
        // Payload shape doesn't matter here: decrypt-then-encrypt round-trips
        // the JSON bytes through a fresh AES-GCM IV under the new key.
        const payload = await decryptJson(oldKey, {
          cipher: record.cipher,
          iv: record.iv,
        });
        const blob = await encryptJson(newKey, payload);
        rewrapped.push({ id: record.id, cipher: blob.cipher, iv: blob.iv });
        setProgress((prev) =>
          prev ? { ...prev, done: prev.done + 1 } : prev,
        );
      }

      setStage('uploading');
      const res = await fetch('/api/vault/master-key/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: accountPassword,
          descriptor: newDescriptor,
          items: rewrapped,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Rotation failed.');
        setStage('idle');
        return;
      }

      // Swap the in-memory vault key. The new key decrypts every item that
      // the server now holds, so nothing else needs to reload.
      unlock(newKey);
      setStage('done');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
      setStage('idle');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="account-password">Account password</Label>
        <Input
          id="account-password"
          type="password"
          autoComplete="current-password"
          value={accountPassword}
          onChange={(e) => setAccountPassword(e.target.value)}
          disabled={busy}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          Confirms it&rsquo;s really you, not just someone with an unlocked
          session.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="current-master">Current master password</Label>
        <Input
          id="current-master"
          type="password"
          autoComplete="current-password"
          value={currentMaster}
          onChange={(e) => setCurrentMaster(e.target.value)}
          disabled={busy}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-master">New master password</Label>
        <Input
          id="new-master"
          type="password"
          autoComplete="new-password"
          value={newMaster}
          onChange={(e) => setNewMaster(e.target.value)}
          disabled={busy}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-master">Confirm new master password</Label>
        <Input
          id="confirm-master"
          type="password"
          autoComplete="new-password"
          value={confirmMaster}
          onChange={(e) => setConfirmMaster(e.target.value)}
          disabled={busy}
        />
        {confirmMaster && confirmMaster !== newMaster && (
          <p className="text-xs text-destructive">Passwords do not match.</p>
        )}
        {newMaster && currentMaster && newMaster === currentMaster && (
          <p className="text-xs text-destructive">
            New password must differ from the current one.
          </p>
        )}
      </div>

      {busy && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {stageLabel(stage)}
          </p>
          {stage === 'reencrypting' && progress && progress.total > 0 && (
            <p className="mt-1 text-xs">
              {progress.done} / {progress.total} items
            </p>
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Version history for every item is cleared because previous versions
        were encrypted with the old key.
      </p>

      <Button type="submit" disabled={!canSubmit} className="w-full gap-1.5">
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Change master password
      </Button>
    </form>
  );
}
