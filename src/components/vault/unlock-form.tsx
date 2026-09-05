'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useVaultKey } from '@/lib/vault/vault-key-context';
import { deriveAndVerify, type KeyDescriptor } from '@/lib/vault/master-key';

export function UnlockForm() {
  const router = useRouter();
  const { unlock } = useVaultKey();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/vault/keyparams');
      if (!res.ok) {
        setError('Could not load your vault. Try signing in again.');
        setBusy(false);
        return;
      }
      const descriptor = (await res.json()) as KeyDescriptor;
      const key = await deriveAndVerify(password, descriptor);
      if (!key) {
        setError('Incorrect master password.');
        setBusy(false);
        return;
      }
      unlock(key);
      router.push('/vault');
    } catch {
      setError('Something went wrong unlocking your vault.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="master">Master password</Label>
        <Input
          id="master"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? 'Unlocking...' : 'Unlock'}
      </Button>
    </form>
  );
}
