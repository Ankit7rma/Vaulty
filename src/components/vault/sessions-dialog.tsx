'use client';

import { useEffect, useState } from 'react';
import { Loader2, LogOut, MonitorSmartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DeviceSession {
  id: string;
  current: boolean;
  userAgent: string | null;
  ipHash: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function summarizeAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const os =
    /Mac OS X/.test(ua)
      ? 'macOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Android/.test(ua)
          ? 'Android'
          : /(iPhone|iPad|iOS)/.test(ua)
            ? 'iOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Unknown';
  const browser = /Firefox/.test(ua)
    ? 'Firefox'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /Chrome/.test(ua)
        ? 'Chrome'
        : /Safari/.test(ua)
          ? 'Safari'
          : 'Browser';
  return `${browser} on ${os}`;
}

export function SessionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80svh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2">
            <MonitorSmartphone
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            Active sessions
          </DialogTitle>
          <DialogDescription>
            One row per device signed in to this account. Sign out others to
            invalidate their session tokens immediately.
          </DialogDescription>
        </DialogHeader>
        {open && <SessionsBody />}
      </DialogContent>
    </Dialog>
  );
}

function SessionsBody() {
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  // Effect reads /api/auth/sessions when mounted or reload requested. Setting
  // state comes from the async callbacks (data / error) — not the effect body.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/sessions', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('load failed');
        const data = (await res.json()) as { sessions: DeviceSession[] };
        if (!cancelled) setSessions(data.sessions);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your sessions.');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  async function signOutOthers() {
    setBusy(true);
    try {
      const res = await fetch('/api/auth/sessions', { method: 'DELETE' });
      if (!res.ok) throw new Error('sign-out failed');
      setReloadTick((t) => t + 1);
    } catch {
      setError('Could not sign out other devices.');
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <p className="p-4 text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }
  if (!sessions) {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading...
      </p>
    );
  }

  const otherCount = sessions.filter((s) => !s.current).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
        {sessions.map((s) => (
          <li key={s.id} className="space-y-1 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-medium">
                {summarizeAgent(s.userAgent)}
              </p>
              {s.current ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                  This device
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Signed in
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Last used {formatWhen(s.lastUsedAt)}
              {s.ipHash && (
                <>
                  {' '}
                  · IP <span className="font-mono">{s.ipHash}</span>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2 border-t bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground">
          {otherCount === 0
            ? 'No other devices signed in.'
            : `${otherCount} other ${otherCount === 1 ? 'device' : 'devices'} signed in.`}
        </p>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={signOutOthers}
          disabled={busy || otherCount === 0}
          className="gap-1.5"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <LogOut className="size-3.5" aria-hidden />
          )}
          Sign out other devices
        </Button>
      </div>
    </div>
  );
}
