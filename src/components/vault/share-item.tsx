'use client';

import { useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClipboard } from '@/lib/vault/use-clipboard';
import { createShareLink } from '@/lib/vault/share';
import type { ItemFields, ItemType } from '@/lib/vault/items';

const EXPIRY_OPTIONS: Array<{ label: string; hours: number }> = [
  { label: '1 hour', hours: 1 },
  { label: '24 hours', hours: 24 },
  { label: '7 days', hours: 24 * 7 },
  { label: '30 days', hours: 24 * 30 },
];

export function ShareItem({
  type,
  fields,
}: {
  type: ItemType;
  fields: ItemFields;
}) {
  const copy = useClipboard();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiryHours, setExpiryHours] = useState<number>(24);
  const [maxViews, setMaxViews] = useState<number>(1);

  async function onShare() {
    setBusy(true);
    setError(null);
    try {
      setUrl(await createShareLink(type, fields, expiryHours, maxViews));
      setCopied(false);
    } catch {
      setError('Could not create a share link.');
    } finally {
      setBusy(false);
    }
  }

  async function onCopy() {
    if (!url) return;
    if (await copy(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  function reset() {
    setUrl(null);
    setError(null);
    setCopied(false);
  }

  return (
    <section
      aria-label="One-time share link"
      className="space-y-2.5 rounded-lg border border-border/70 bg-muted/30 p-3"
    >
      <header className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Share2 className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight">
            One-time share link
          </p>
          <p className="text-xs text-muted-foreground">
            Opens once, then self-destructs. The decryption key stays in the
            link and never reaches the server.
          </p>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/8 px-2.5 py-2 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {url ? (
        <div className="space-y-2">
          <div className="rounded-md border border-border/70 bg-background p-2">
            <code className="block max-h-24 overflow-y-auto text-[11px] leading-relaxed break-all text-foreground/90">
              {url}
            </code>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={onCopy}
              className="gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="size-3.5" aria-hidden /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" aria-hidden /> Copy link
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={reset}
              disabled={busy}
              className="gap-1.5"
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Create another
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Expires in
            <select
              value={expiryHours}
              onChange={(e) => setExpiryHours(Number(e.target.value))}
              disabled={busy}
              className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
              aria-label="Share expiry"
            >
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.hours} value={o.hours}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Views
            <select
              value={maxViews}
              onChange={(e) => setMaxViews(Number(e.target.value))}
              disabled={busy}
              className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
              aria-label="Number of allowed views"
            >
              <option value={1}>1 (one-time)</option>
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onShare}
            disabled={busy}
            className="ml-auto gap-1.5"
          >
            {busy ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Creating link...
              </>
            ) : (
              <>
                <Share2 className="size-3.5" aria-hidden />
                Generate share link
              </>
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
