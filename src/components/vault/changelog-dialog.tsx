'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ReleaseNote {
  version: string;
  date: string;
  items: string[];
}

/**
 * Static changelog. Newer entries at the top. Bump the top entry's version
 * (or add a new one) to surface an unread indicator on the header button.
 */
export const CHANGELOG: ReleaseNote[] = [
  {
    version: '0.3.0',
    date: '2026-09',
    items: [
      'Security report with duplicate, weak, reused, and HIBP breach checks',
      'Item templates (email, bank, wi-fi, recovery codes)',
      'Tags with a filter chip row + bulk-add from the action bar',
      'Trash view with soft-delete and restore',
      'Favorites (starred items hoist to the top)',
      'Cmd+K command palette and global keyboard shortcuts',
      'Fuzzy multi-token search over all item fields',
      'Dark mode with system preference detection',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-08',
    items: [
      'Redesigned login/signup with branded auth shell',
      'Redesigned item dialog with scrollable body and sticky footer',
      'Share panel: bordered layout, copy button, "generate another"',
      'HTTP security headers (CSP, HSTS, X-Frame-Options)',
      'Rate limiting on auth endpoints (Upstash + in-memory fallback)',
      'Nightly Vercel Cron cleanup of expired shares',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-07',
    items: [
      'Client-side crypto: Argon2id + AES-GCM',
      'Two-password model (account vs master)',
      'Vault CRUD with encrypt-before-send',
      'Password generator, clipboard auto-clear, auto-lock',
      'One-time encrypted share links (URL-fragment key)',
      'TOTP (2FA) codes stored encrypted',
    ],
  },
];

const STORAGE_KEY = 'vaulty.changelog.lastSeen';
const CURRENT_VERSION = CHANGELOG[0]?.version ?? '';

function readLastSeen(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Returns true if the current top release is newer than the last dismissal. */
export function useChangelogHasUpdates(): boolean {
  // useSyncExternalStore is the SSR-safe way to read localStorage: the server
  // snapshot returns `false` (no dot), and the client hydrates with the real
  // value without a setState-in-effect round-trip.
  return useSyncExternalStore(
    subscribeToStorage,
    () => readLastSeen() !== CURRENT_VERSION,
    () => false,
  );
}

function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

export function ChangelogDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Mark the current version seen the first time the user opens the dialog.
  useEffect(() => {
    if (!open || !CURRENT_VERSION) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    } catch {
      // Storage may be unavailable in private mode.
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80svh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden />
            What&rsquo;s new
          </DialogTitle>
          <DialogDescription>
            Highlights from recent Vaulty releases.
          </DialogDescription>
        </DialogHeader>

        <ul className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
          {CHANGELOG.map((release) => (
            <li key={release.version}>
              <div className="mb-2 flex items-baseline gap-2">
                <h3 className="text-sm font-semibold">v{release.version}</h3>
                <span className="text-xs text-muted-foreground">
                  {release.date}
                </span>
              </div>
              <ul className="space-y-1 pl-4">
                {release.items.map((item) => (
                  <li
                    key={item}
                    className="list-disc text-sm text-foreground/90 marker:text-muted-foreground"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

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
