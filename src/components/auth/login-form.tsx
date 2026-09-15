'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasskeySignInButton } from './passkey-signin-button';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingTotp, setPendingTotp] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Could not sign in.');
        setBusy(false);
        return;
      }
      const data = await res.json();
      if (data.requiresTotp && data.pending) {
        setPendingTotp(data.pending);
        setBusy(false);
        return;
      }
      // Onboarded users go straight to unlock; others finish setup first.
      router.push(data.onboarded ? '/unlock' : '/onboard');
    } catch {
      setError('Network error. Please try again.');
      setBusy(false);
    }
  }

  async function verifyTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingTotp) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending: pendingTotp, code: totpCode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Invalid code.');
        setBusy(false);
        return;
      }
      const data = await res.json();
      router.push(data.onboarded ? '/unlock' : '/onboard');
    } catch {
      setError('Network error. Please try again.');
      setBusy(false);
    }
  }

  if (pendingTotp) {
    return (
      <form onSubmit={verifyTotp} className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-md border bg-muted/40 px-3 py-2.5 text-sm">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden
          />
          <span>
            Enter the 6-digit code from your authenticator app.
          </span>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="totp">One-time code</Label>
          <Input
            id="totp"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            placeholder="123456"
            required
            autoFocus
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
            className="h-10 tracking-widest font-mono text-center text-lg"
            maxLength={8}
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="mt-2 h-10 w-full text-sm font-medium"
          disabled={busy || totpCode.length < 6}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Verifying...
            </>
          ) : (
            'Verify'
          )}
        </Button>

        <button
          type="button"
          onClick={() => {
            setPendingTotp(null);
            setTotpCode('');
            setError(null);
          }}
          className="w-full text-xs text-muted-foreground hover:text-foreground"
        >
          Back to sign in
        </button>
      </form>
    );
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

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Account password</Label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Your account password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 px-9"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring/50"
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        className="mt-2 h-10 w-full text-sm font-medium"
        disabled={busy}
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Signing in...
          </>
        ) : (
          'Sign in'
        )}
      </Button>

      <div className="flex items-center gap-3 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <PasskeySignInButton />
    </form>
  );
}
