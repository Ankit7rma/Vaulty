'use client';

import { useEffect, useState } from 'react';
import { Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SentShare {
  id: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  maxViews: number;
  viewCount: number;
}

interface SentSharesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatWhen(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function relative(iso: string): string {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = target - now;
  const past = diffMs < 0;
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const value = days >= 1 ? `${days}d` : hours >= 1 ? `${hours}h` : `${mins}m`;
  return past ? `${value} ago` : `in ${value}`;
}

export function SentSharesDialog({ open, onOpenChange }: SentSharesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80svh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-4 text-muted-foreground" aria-hidden />
            Sent shares
          </DialogTitle>
          <DialogDescription>
            Server sees only tokens, timestamps, and view counts. Item contents
            stayed encrypted with the key that lives in each URL fragment.
          </DialogDescription>
        </DialogHeader>
        {open && <SentSharesBody />}
        <div className="border-t bg-muted/40 p-3 text-right">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SentSharesBody() {
  const [shares, setShares] = useState<SentShare[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/share')
      .then((res) => {
        if (!res.ok) throw new Error('load failed');
        return res.json() as Promise<{ shares: SentShare[] }>;
      })
      .then((data) => {
        if (!cancelled) setShares(data.shares);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your shares.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="p-4 text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }
  if (!shares) {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading...
      </p>
    );
  }
  if (shares.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No shares yet. Generate one from any item&rsquo;s share panel.
      </p>
    );
  }

  return (
    <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
      {shares.map((share) => {
        const remaining = share.maxViews - share.viewCount;
        const expired = new Date(share.expiresAt) < new Date();
        return (
          <li key={share.id} className="space-y-1 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-mono text-xs">
                #{share.token.slice(0, 12)}
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  expired
                    ? 'bg-muted text-muted-foreground'
                    : remaining === 0
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-primary/15 text-primary'
                }`}
              >
                {expired
                  ? 'Expired'
                  : `${remaining} of ${share.maxViews} left`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Created {relative(share.createdAt)} · Expires{' '}
              {relative(share.expiresAt)} ({formatWhen(share.expiresAt)})
            </p>
          </li>
        );
      })}
    </ul>
  );
}
