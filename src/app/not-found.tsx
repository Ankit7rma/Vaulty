import Link from 'next/link';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border/60 bg-card/90 p-8 text-center shadow-xl">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Search className="size-6" aria-hidden />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            404
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Page not found
          </h1>
          <p className="text-sm text-muted-foreground">
            The link may be broken, or the share you were looking for has
            already been opened.
          </p>
        </div>
        <Button render={<Link href="/" />}>Back to Vaulty</Button>
      </div>
    </main>
  );
}
