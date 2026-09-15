'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Plus, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { normalizeCidr } from '@/lib/auth/ip-allowlist';

interface AllowlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AllowlistDialog({ open, onOpenChange }: AllowlistDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80svh] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            Login IP allowlist
          </DialogTitle>
          <DialogDescription>
            When set, sign-in is only allowed from these networks. Leave the
            list empty to accept sign-in from anywhere.
          </DialogDescription>
        </DialogHeader>
        {open && <AllowlistBody onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AllowlistBody({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<string[] | null>(null);
  const [currentIp, setCurrentIp] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/allowlist', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('load failed');
        return res.json() as Promise<{
          entries: string[];
          currentIp: string | null;
        }>;
      })
      .then((data) => {
        if (cancelled) return;
        setEntries(data.entries);
        setCurrentIp(data.currentIp);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your allowlist.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function addDraft() {
    if (entries === null) return;
    const normalized = normalizeCidr(draft);
    if (!normalized) {
      setError(
        'Enter an IPv4 address or CIDR range, e.g. 203.0.113.4/32 or 10.0.0.0/8.',
      );
      return;
    }
    if (entries.includes(normalized)) {
      setError('That entry is already in your allowlist.');
      return;
    }
    setEntries([...entries, normalized]);
    setDraft('');
    setError(null);
  }

  function addCurrent() {
    if (!currentIp || entries === null) return;
    const asCidr = /^\d{1,3}(\.\d{1,3}){3}$/.test(currentIp)
      ? `${currentIp}/32`
      : currentIp;
    const normalized = normalizeCidr(asCidr);
    if (!normalized || entries.includes(normalized)) return;
    setEntries([...entries, normalized]);
    setError(null);
  }

  function remove(entry: string) {
    if (entries === null) return;
    setEntries(entries.filter((e) => e !== entry));
  }

  async function save() {
    if (entries === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/allowlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) throw new Error('save failed');
      const data = (await res.json()) as { entries: string[] };
      setEntries(data.entries);
      onClose();
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (entries === null) {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading...
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {entries.length > 0 && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-400"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Add an entry that covers your current network before signing
              out, or you may be locked out next login.
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="203.0.113.4/32 or 10.0.0.0/8"
            className="font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDraft();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={addDraft}
            className="gap-1.5"
          >
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        </div>

        {currentIp && (
          <p className="text-xs text-muted-foreground">
            Your current source IP:{' '}
            <span className="font-mono">{currentIp}</span>{' '}
            <button
              type="button"
              onClick={addCurrent}
              className="text-primary hover:underline"
            >
              Add /32
            </button>
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {entries.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            Empty allowlist. Sign-in accepted from any network.
          </p>
        ) : (
          <ul className="space-y-1">
            {entries.map((entry) => (
              <li
                key={entry}
                className="flex items-center gap-2 rounded-md border bg-background px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-sm">
                  {entry}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(entry)}
                  aria-label={`Remove ${entry}`}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t bg-muted/40 p-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={save}
          disabled={busy}
          className="gap-1.5"
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Save allowlist
        </Button>
      </div>
    </div>
  );
}
