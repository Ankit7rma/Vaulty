'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyButton } from './copy-button';
import { createShareLink } from '@/lib/vault/share';
import type { ItemFields, ItemType } from '@/lib/vault/items';

export function ShareItem({
  type,
  fields,
}: {
  type: ItemType;
  fields: ItemFields;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onShare() {
    setBusy(true);
    setError(null);
    try {
      setUrl(await createShareLink(type, fields));
    } catch {
      setError('Could not create a share link.');
    } finally {
      setBusy(false);
    }
  }

  if (url) {
    return (
      <div className="space-y-1 rounded-md border bg-muted/40 p-2">
        <div className="flex items-center gap-1">
          <code className="min-w-0 flex-1 truncate text-xs">{url}</code>
          <CopyButton value={url} label="share link" />
        </div>
        <p className="text-xs text-muted-foreground">
          Opens once, then self-destructs. The decryption key is in the link and
          never reaches the server.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Button type="button" variant="outline" onClick={onShare} disabled={busy}>
        <Share2 /> {busy ? 'Creating link...' : 'Share via one-time link'}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
