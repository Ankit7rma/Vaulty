'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  KeyRound,
  LayoutTemplate,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STORAGE_KEY = 'vaulty.tour.completed';

interface TourStep {
  title: string;
  body: string;
  icon: React.ReactNode;
}

const STEPS: TourStep[] = [
  {
    icon: <KeyRound className="size-5" aria-hidden />,
    title: 'Welcome to your vault',
    body:
      'Everything you add here is encrypted in your browser with AES-GCM before it leaves. The server only ever stores opaque blobs. Even the item title is encrypted.',
  },
  {
    icon: <Star className="size-5" aria-hidden />,
    title: 'Star and tag as you go',
    body:
      'Star items you use most to hoist them to the top. Add tags to group items across services; the tag chip row above the list filters instantly.',
  },
  {
    icon: <ShieldCheck className="size-5" aria-hidden />,
    title: 'Run the security report',
    body:
      'The shield button opens a report of duplicate logins, weak passwords, password reuse, and (on demand) HaveIBeenPwned breach matches. Everything runs in your browser.',
  },
  {
    icon: <LayoutTemplate className="size-5" aria-hidden />,
    title: 'Cmd+K opens the command palette',
    body:
      'Fastest way to search, create, or jump. n adds a login, Shift+N adds a note, / focuses search, and ? opens the full shortcut list.',
  },
  {
    icon: <Sparkles className="size-5" aria-hidden />,
    title: 'Lock when you step away',
    body:
      'The vault key lives only in memory. Cmd+L (or the Lock button) wipes it immediately; auto-lock does the same after your configured idle window.',
  },
];

function readCompleted(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

/**
 * Returns true once the tour has been completed. Reads localStorage
 * SSR-safely so no hydration mismatch and no setState-in-effect.
 */
export function useTourCompleted(): boolean {
  return useSyncExternalStore(
    subscribeToStorage,
    readCompleted,
    () => true,
  );
}

export function OnboardingTour({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  function finish() {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // localStorage may be unavailable in private mode.
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : finish())}>
      <DialogContent className="sm:max-w-md">
        {/* Body mounts on open so step state resets naturally each time. */}
        {open && <TourBody onFinish={finish} />}
      </DialogContent>
    </Dialog>
  );
}

function TourBody({ onFinish }: { onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;
  const progressLabel = useMemo(
    () => `${index + 1} of ${STEPS.length}`,
    [index],
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            {step.icon}
          </span>
          {step.title}
        </DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">{step.body}</p>

      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-1" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`size-1.5 rounded-full transition-colors ${
                i === index ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {progressLabel}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onFinish}>
            Skip
          </Button>
          {isLast ? (
            <Button type="button" size="sm" onClick={onFinish}>
              Get started
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => setIndex((i) => Math.min(STEPS.length - 1, i + 1))}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
