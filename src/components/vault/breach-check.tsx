'use client';

import { useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { checkPasswordBreached } from '@/lib/vault/breach-check';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'safe' }
  | { status: 'breached'; count: number }
  | { status: 'error' };

/**
 * On-demand HaveIBeenPwned check for the current password. Deliberately manual
 * (a button, not on every keystroke) so we make at most one API call per check.
 * See checkPasswordBreached for the k-anonymity guarantee.
 */
export function BreachCheck({ password }: { password: string }) {
  const [state, setState] = useState<State>({ status: 'idle' });

  async function run() {
    setState({ status: 'loading' });
    try {
      const result = await checkPasswordBreached(password);
      setState(
        result.breached
          ? { status: 'breached', count: result.count }
          : { status: 'safe' },
      );
    } catch {
      setState({ status: 'error' });
    }
  }

  if (!password) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={run}
        disabled={state.status === 'loading'}
      >
        {state.status === 'loading' ? 'Checking...' : 'Check for breaches'}
      </Button>
      {state.status === 'safe' && (
        <span className="flex items-center gap-1 text-green-600 dark:text-green-500">
          <ShieldCheck className="size-3.5" /> Not found in known breaches
        </span>
      )}
      {state.status === 'breached' && (
        <span className="flex items-center gap-1 text-destructive">
          <ShieldAlert className="size-3.5" /> Found in{' '}
          {state.count.toLocaleString()} breaches
        </span>
      )}
      {state.status === 'error' && (
        <span className="text-muted-foreground">Check unavailable</span>
      )}
    </div>
  );
}
