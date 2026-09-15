'use client';

import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { Fingerprint, Loader2 } from 'lucide-react';
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

interface PasskeySetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered?: () => void;
}

export function PasskeySetupDialog({
  open,
  onOpenChange,
  onRegistered,
}: PasskeySetupDialogProps) {
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enroll() {
    setBusy(true);
    setError(null);
    try {
      const optionsRes = await fetch('/api/auth/passkey/register-options', {
        method: 'POST',
      });
      if (!optionsRes.ok) throw new Error('options failed');
      const options = await optionsRes.json();
      const response = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch('/api/auth/passkey/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response, label: label.trim() || undefined }),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json().catch(() => ({}));
        setError(data.error ?? 'Registration failed.');
        return;
      }
      onRegistered?.();
      onOpenChange(false);
      setLabel('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Registration was cancelled.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fingerprint
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            Register a passkey
          </DialogTitle>
          <DialogDescription>
            Use your device&rsquo;s biometrics or a hardware key (YubiKey,
            iCloud Keychain, 1Password, Chrome Password Manager). Signs you in
            with no password on subsequent visits.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="passkey-label">Label (optional)</Label>
            <Input
              id="passkey-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. MacBook Touch ID"
              maxLength={64}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={enroll}
              disabled={busy}
              className="gap-1.5"
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Enroll passkey
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
