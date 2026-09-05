'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useVaultKey } from '@/lib/vault/vault-key-context';
import { enrollMasterKey } from '@/lib/vault/master-key';

const MIN_MASTER_LENGTH = 8;

export function OnboardForm() {
  const router = useRouter();
  const { unlock } = useVaultKey();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_MASTER_LENGTH) {
      setError(`Master password must be at least ${MIN_MASTER_LENGTH} characters.`);
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
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="master">Master password</Label>
        <Input
          id="master"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm master password</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? 'Encrypting your vault...' : 'Set master password'}
      </Button>
    </form>
  );
}
