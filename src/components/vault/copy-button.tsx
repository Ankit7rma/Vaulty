'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClipboard } from '@/lib/vault/use-clipboard';

/**
 * Copies a secret with brief "copied" feedback. The clipboard is auto-cleared
 * after the configured delay (see useClipboard).
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const copy = useClipboard();
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    if (!value) return;
    if (await copy(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onCopy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={`Copy ${label}`}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}
