'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Ban,
  History,
  Loader2,
  LogIn,
  LogOut,
  Share2,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AuditEntry {
  id: string;
  event: string;
  meta: unknown;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: string;
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

interface EventDisplay {
  label: string;
  icon: React.ReactNode;
  tone: 'positive' | 'neutral' | 'warning' | 'destructive';
}

function display(event: string): EventDisplay {
  switch (event) {
    case 'login.success':
      return {
        label: 'Signed in',
        icon: <LogIn className="size-4" aria-hidden />,
        tone: 'positive',
      };
    case 'login.failed':
      return {
        label: 'Failed sign-in attempt',
        icon: <AlertCircle className="size-4" aria-hidden />,
        tone: 'warning',
      };
    case 'login.ip_blocked':
      return {
        label: 'Sign-in blocked by IP allowlist',
        icon: <ShieldX className="size-4" aria-hidden />,
        tone: 'destructive',
      };
    case 'session.signout':
      return {
        label: 'Signed out',
        icon: <LogOut className="size-4" aria-hidden />,
        tone: 'neutral',
      };
    case 'session.signout_others':
      return {
        label: 'Signed out other devices',
        icon: <Ban className="size-4" aria-hidden />,
        tone: 'warning',
      };
    case 'allowlist.updated':
      return {
        label: 'Updated IP allowlist',
        icon: <ShieldCheck className="size-4" aria-hidden />,
        tone: 'neutral',
      };
    case 'share.created':
      return {
        label: 'Created a share link',
        icon: <Share2 className="size-4" aria-hidden />,
        tone: 'neutral',
      };
    case 'share.revoked':
      return {
        label: 'Revoked a share link',
        icon: <Ban className="size-4" aria-hidden />,
        tone: 'warning',
      };
    default:
      return {
        label: event,
        icon: <History className="size-4" aria-hidden />,
        tone: 'neutral',
      };
  }
}

const TONE_CLASSES: Record<EventDisplay['tone'], string> = {
  positive: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  neutral: 'bg-muted text-muted-foreground',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-500',
  destructive: 'bg-destructive/15 text-destructive',
};

export function AuditLogDialog({
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
            <History className="size-4 text-muted-foreground" aria-hidden />
            Audit log
          </DialogTitle>
          <DialogDescription>
            Recent security-sensitive events on your account. IPs are hashed
            and truncated; no passwords or item contents are recorded here.
          </DialogDescription>
        </DialogHeader>
        {open && <AuditLogBody />}
      </DialogContent>
    </Dialog>
  );
}

function AuditLogBody() {
  const [events, setEvents] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/audit', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('load failed');
        const data = (await res.json()) as { events: AuditEntry[] };
        if (!cancelled) setEvents(data.events);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the audit log.');
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
  if (!events) {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading...
      </p>
    );
  }
  if (events.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No events recorded yet.
      </p>
    );
  }

  return (
    <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
      {events.map((entry) => {
        const info = display(entry.event);
        return (
          <li key={entry.id} className="flex items-start gap-3 p-3">
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-md ${TONE_CLASSES[info.tone]}`}
            >
              {info.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{info.label}</p>
              <p className="text-xs text-muted-foreground">
                {formatWhen(entry.createdAt)}
                {entry.ipHash && (
                  <>
                    {' '}
                    · <span className="font-mono">{entry.ipHash}</span>
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
