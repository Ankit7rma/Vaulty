'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';
import { Fingerprint, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Passkey sign-in button used on the login page. Runs the WebAuthn
 * authentication ceremony discoverably — the browser lists whichever
 * credentials it has registered for this domain.
 */
export function PasskeySignInButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const optionsRes = await fetch('/api/auth/passkey/auth-options', {
        method: 'POST',
      });
      if (!optionsRes.ok) throw new Error('options failed');
      const options = await optionsRes.json();
      const response = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch('/api/auth/passkey/auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json().catch(() => ({}));
        setError(data.error ?? 'Passkey sign-in failed.');
        return;
      }
      const data = await verifyRes.json();
      router.push(data.onboarded ? '/unlock' : '/onboard');
    } catch {
      // startAuthentication throws on user cancellation; treat as no-op.
      setError(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={signIn}
        disabled={busy}
        className="h-10 w-full gap-1.5 text-sm"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Fingerprint className="size-4" aria-hidden />
        )}
        Sign in with a passkey
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
