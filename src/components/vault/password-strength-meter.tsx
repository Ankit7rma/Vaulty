'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { estimateStrength } from '@/lib/vault/password-strength';

// Segment colour keyed by score (0..4).
const SCORE_COLOR = [
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-lime-500',
  'bg-green-600',
] as const;

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { score, label } = useMemo(
    () => estimateStrength(password),
    [password],
  );

  if (!password) return null;

  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i <= score ? SCORE_COLOR[score] : 'bg-muted',
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Strength: {label}</p>
    </div>
  );
}
