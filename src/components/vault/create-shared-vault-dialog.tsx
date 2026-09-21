'use client';

import { useState } from 'react';
import { AlertCircle, Loader2, Users } from 'lucide-react';
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
import type { SharedVaultSummary } from '@/lib/vault/use-shared-vaults';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<SharedVaultSummary>;
  onCreated?: (vault: SharedVaultSummary) => void;
}

export function CreateSharedVaultDialog({
  open,
  onOpenChange,
  onCreate,
  onCreated,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" aria-hidden />
            New shared vault
          </DialogTitle>
          <DialogDescription>
            A shared vault holds items encrypted under a single key. Members
            you invite each get a copy wrapped with their own keypair — the
            server never sees the vault key.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <Body
            onCreate={onCreate}
            onCreated={(v) => {
              onCreated?.(v);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Body({
  onCreate,
  onCreated,
}: {
  onCreate: (name: string) => Promise<SharedVaultSummary>;
  onCreated: (vault: SharedVaultSummary) => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const vault = await onCreate(trimmed);
      onCreated(vault);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create vault.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="shared-vault-name">Name</Label>
        <Input
          id="shared-vault-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Family, Work team, ..."
          disabled={busy}
          autoFocus
          required
        />
        <p className="text-xs text-muted-foreground">
          Only members can read the name — it&rsquo;s encrypted client-side
          along with every item inside.
        </p>
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}
      <Button
        type="submit"
        disabled={busy || name.trim().length === 0}
        className="w-full gap-1.5"
      >
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Create shared vault
      </Button>
    </form>
  );
}
