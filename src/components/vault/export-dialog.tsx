'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Unlock,
} from 'lucide-react';
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
import { PasswordStrengthMeter } from './password-strength-meter';
import {
  buildEncryptedExport,
  buildPlainExport,
  downloadJson,
  todayStamp,
} from '@/lib/vault/export';
import { estimateStrength } from '@/lib/vault/password-strength';
import type { VaultItem } from '@/lib/vault/items';

type Mode = 'encrypted' | 'plain';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: VaultItem[];
}

export function ExportDialog({ open, onOpenChange, items }: ExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export vault</DialogTitle>
          <DialogDescription>
            Save every item to a JSON file. Runs entirely in the browser.
          </DialogDescription>
        </DialogHeader>
        {open && <ExportBody items={items} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ExportBody({
  items,
  onClose,
}: {
  items: VaultItem[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>('encrypted');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = useMemo(() => estimateStrength(passphrase), [passphrase]);
  const strongEnough = passphrase.length >= 12 && strength.score >= 2;

  async function run() {
    setError(null);
    if (mode === 'encrypted') {
      if (!strongEnough) {
        setError('Passphrase must be at least 12 characters and rated Fair or better.');
        return;
      }
      if (passphrase !== confirm) {
        setError('Passphrases do not match.');
        return;
      }
      setBusy(true);
      try {
        const file = await buildEncryptedExport(items, passphrase);
        downloadJson(`vaulty-${todayStamp()}.enc.json`, file);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Export failed.');
      } finally {
        setBusy(false);
      }
    } else {
      const file = buildPlainExport(items);
      downloadJson(`vaulty-${todayStamp()}.plain.json`, file);
      onClose();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <ModeButton
          active={mode === 'encrypted'}
          onClick={() => setMode('encrypted')}
          icon={<Lock className="size-4" aria-hidden />}
          title="Encrypted"
          hint="Passphrase-protected"
        />
        <ModeButton
          active={mode === 'plain'}
          onClick={() => setMode('plain')}
          icon={<Unlock className="size-4" aria-hidden />}
          title="Plain JSON"
          hint="Unencrypted"
        />
      </div>

      {mode === 'plain' && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-400"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            The file will contain every field in plaintext, including passwords
            and seed phrases. Store it somewhere you already trust and delete
            it when you are done.
          </span>
        </div>
      )}

      {mode === 'encrypted' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="export-pass">Export passphrase</Label>
            <div className="relative">
              <Input
                id="export-pass"
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase((s) => !s)}
                aria-label={
                  showPassphrase ? 'Hide passphrase' : 'Show passphrase'
                }
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {showPassphrase ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
            <PasswordStrengthMeter password={passphrase} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="export-confirm">Confirm passphrase</Label>
            <Input
              id="export-confirm"
              type={showPassphrase ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            The passphrase is used with Argon2id to derive an AES-GCM key.
            Losing it means losing the file&rsquo;s contents.
          </p>
        </>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={run}
          disabled={busy || items.length === 0}
          className="gap-1.5"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          Download {items.length} item{items.length === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
        active
          ? 'border-primary bg-primary/5'
          : 'border-border hover:bg-muted/50'
      }`}
    >
      <div className="mb-1 flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {title}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </button>
  );
}
