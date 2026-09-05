'use client';

import { useEffect, useState } from 'react';
import { generateTotp, totpRemainingSeconds } from '@/lib/vault/totp';
import { CopyButton } from './copy-button';

/**
 * Live 6-digit TOTP code with a countdown, refreshed every second. The secret
 * is only ever used here in the browser to derive codes.
 */
export function TotpCode({ secret }: { secret: string }) {
  const [code, setCode] = useState('');
  const [remaining, setRemaining] = useState(30);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const next = await generateTotp(secret);
        if (!active) return;
        setCode(next);
        setRemaining(totpRemainingSeconds());
        setError(false);
      } catch {
        if (active) setError(true);
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [secret]);

  if (error) {
    return <p className="text-xs text-destructive">Invalid TOTP secret</p>;
  }

  const formatted = code ? `${code.slice(0, 3)} ${code.slice(3)}` : '--- ---';

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
      <span className="font-mono text-lg tracking-wider tabular-nums">
        {formatted}
      </span>
      <span className="min-w-8 text-xs tabular-nums text-muted-foreground">
        {remaining}s
      </span>
      <CopyButton value={code} label="one-time code" />
    </div>
  );
}
