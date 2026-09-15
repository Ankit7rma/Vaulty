'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
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
import { CopyButton } from './copy-button';

interface TotpSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnabled: () => void;
}

export function TotpSetupDialog({
  open,
  onOpenChange,
  onEnabled,
}: TotpSetupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            Set up two-factor authentication
          </DialogTitle>
          <DialogDescription>
            Use any TOTP app (1Password, Authy, Google Authenticator, Vaulty
            itself) to scan the URI below, then confirm with a code.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <TotpSetupBody
            onDone={() => {
              onEnabled();
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TotpSetupBody({ onDone }: { onDone: () => void }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/totp/setup', { method: 'POST', cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('setup failed');
        return res.json() as Promise<{ secret: string; otpauth: string }>;
      })
      .then((data) => {
        if (cancelled) return;
        setSecret(data.secret);
        setOtpauth(data.otpauth);
      })
      .catch(() => {
        if (!cancelled) setError('Could not start enrollment.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirm() {
    if (!secret) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/totp/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Invalid code.');
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  if (!secret || !otpauth) {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Generating a
        fresh secret...
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Provisioning URI</Label>
        <div className="flex items-center gap-1">
          <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 font-mono text-xs">
            {otpauth}
          </code>
          <CopyButton value={otpauth} label="otpauth URI" />
        </div>
        <p className="text-xs text-muted-foreground">
          Or type the secret manually:{' '}
          <span className="font-mono">{secret}</span>
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="totp-confirm">6-digit code from the app</Label>
        <Input
          id="totp-confirm"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="tracking-widest font-mono text-center text-lg"
          maxLength={8}
          autoFocus
        />
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
        type="button"
        onClick={confirm}
        disabled={busy || code.length < 6}
        className="w-full gap-1.5"
      >
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Enable 2FA
      </Button>
      <p className="text-xs text-muted-foreground">
        Losing your authenticator will lock you out of the account. Keep the
        secret above somewhere safe (or add it to Vaulty itself as an item).
      </p>
    </div>
  );
}

interface TotpDisableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisabled: () => void;
}

export function TotpDisableDialog({
  open,
  onOpenChange,
  onDisabled,
}: TotpDisableDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/totp/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Could not disable 2FA.');
        return;
      }
      setPassword('');
      onDisabled();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Disable two-factor authentication?</DialogTitle>
          <DialogDescription>
            Enter your account password to confirm.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Account password"
            autoFocus
          />
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
              variant="destructive"
              onClick={confirm}
              disabled={busy || password.length === 0}
              className="gap-1.5"
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Disable
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
