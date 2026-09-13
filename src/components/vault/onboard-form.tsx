'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrengthMeter } from './password-strength-meter';
import { useVaultKey } from '@/lib/vault/vault-key-context';
import { enrollMasterKey } from '@/lib/vault/master-key';
import { estimateStrength } from '@/lib/vault/password-strength';

const MIN_MASTER_LENGTH = 12;
// zxcvbn score 3 = "Strong". Master password is our only barrier to the
// vault so we insist on Strong or better before allowing enrollment.
const MIN_MASTER_SCORE = 3;

export function OnboardForm() {
  const router = useRouter();
  const { unlock } = useVaultKey();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const strength = useMemo(() => estimateStrength(password), [password]);
  const strongEnough = strength.score >= MIN_MASTER_SCORE;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_MASTER_LENGTH) {
      setError(
        `Master password must be at least ${MIN_MASTER_LENGTH} characters.`,
      );
      return;
    }
    if (!strongEnough) {
      setError(
        'Master password is too easy to guess. Try a longer passphrase with more variety.',
      );
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      // Derive the key and seal the check blob entirely in the browser.
      const { key, descriptor } = await enrollMasterKey(password);
      const res = await fetch('/api/vault/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(descriptor),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Could not save your master password.');
        setBusy(false);
        return;
      }
      unlock(key);
      router.push('/vault');
    } catch {
      setError('Something went wrong setting up your vault.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-md border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          This encrypts your vault and never leaves your device. If you forget
          it there is no way to recover your data.
        </span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="master">Master password</Label>
        <div className="relative">
          <Input
            id="master"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
        {password.length > 0 && (
          <>
            <PasswordStrengthMeter password={password} />
            {!strongEnough && (
              <p className="text-xs text-muted-foreground">
                Aim for at least {MIN_MASTER_LENGTH} characters and mix in
                numbers or symbols. A memorable four-word passphrase works
                well.
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm master password</Label>
        <Input
          id="confirm"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full gap-1.5"
        disabled={busy}
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Encrypting your vault...
          </>
        ) : (
          'Set master password'
        )}
      </Button>
    </form>
  );
}
