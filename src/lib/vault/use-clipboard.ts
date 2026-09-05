'use client';

import { useCallback } from 'react';
import { useSettings } from '@/lib/settings/settings-context';

/**
 * Copies a value and, per the user's setting, wipes the clipboard after a delay
 * so secrets don't linger. The clear is best-effort: it overwrites whatever is
 * on the clipboard when it fires, which is the accepted behaviour for password
 * managers (reading the clipboard back to compare would require a permission
 * prompt).
 */
export function useClipboard(): (value: string) => Promise<boolean> {
  const { clipboardClearSeconds } = useSettings();

  return useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        return false;
      }
      if (value && clipboardClearSeconds > 0) {
        setTimeout(() => {
          navigator.clipboard.writeText('').catch(() => {});
        }, clipboardClearSeconds * 1000);
      }
      return true;
    },
    [clipboardClearSeconds],
  );
}
