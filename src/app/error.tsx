'use client';

import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border/60 bg-card/90 p-8 text-center shadow-xl">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            The vault stayed locked and your data is safe. If this keeps
            happening, try locking the vault and signing in again.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset} className="gap-1.5">
            <RefreshCw className="size-4" aria-hidden />
            Try again
          </Button>
          <Button variant="outline" render={<Link href="/" />}>
            Go home
          </Button>
        </div>
      </div>
    </main>
  );
}
