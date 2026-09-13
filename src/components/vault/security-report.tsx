'use client';

import { useMemo } from 'react';
import { KeyRound, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  findDuplicates,
  findReusedPasswords,
  findWeakPasswords,
} from '@/lib/vault/reports';
import type { VaultItem } from '@/lib/vault/items';

interface SecurityReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: VaultItem[];
  onOpenItem: (item: VaultItem) => void;
}

export function SecurityReport({
  open,
  onOpenChange,
  items,
  onOpenItem,
}: SecurityReportProps) {
  const duplicates = useMemo(() => findDuplicates(items), [items]);
  const weak = useMemo(() => findWeakPasswords(items), [items]);
  const reused = useMemo(() => findReusedPasswords(items), [items]);
  const anyIssues =
    duplicates.length > 0 || weak.length > 0 || reused.length > 0;

  function jumpTo(id: string) {
    const item = items.find((i) => i.id === id);
    if (item) onOpenItem(item);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80svh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4">
          <DialogTitle>Security report</DialogTitle>
          <DialogDescription>
            All checks run in your browser over decrypted items.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
          {!anyIssues && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4">
              <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium">Nothing to fix right now</p>
                <p className="text-xs text-muted-foreground">
                  Every check passed.
                </p>
              </div>
            </div>
          )}

          <ReportSection
            title="Weak passwords"
            hint="Estimated below Fair on the zxcvbn scale."
            count={weak.length}
            icon={<KeyRound className="size-4" aria-hidden />}
            tone="warning"
          >
            {weak.length === 0 ? (
              <EmptyRow text="No weak passwords found." />
            ) : (
              <ul className="space-y-1.5">
                {weak.map(({ item, label }) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => jumpTo(item.id)}
                      className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {item.title}
                      </span>
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-500">
                        {label}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ReportSection>

          <ReportSection
            title="Reused passwords"
            hint="The same password across different services."
            count={reused.length}
            icon={<RefreshCw className="size-4" aria-hidden />}
            tone="warning"
          >
            {reused.length === 0 ? (
              <EmptyRow text="No password reuse detected." />
            ) : (
              <ul className="space-y-3">
                {reused.map((group) => (
                  <li
                    key={group.bucketId}
                    className="rounded-md border bg-background p-3"
                  >
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {group.members.length} entries share one password
                    </p>
                    <ul className="space-y-1">
                      {group.members.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => jumpTo(m.id)}
                            className="w-full rounded px-1.5 py-1 text-left text-sm hover:bg-muted"
                          >
                            <span className="font-medium">{m.title}</span>
                            {m.username && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {m.username}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </ReportSection>

          <ReportSection
            title="Duplicate logins"
            hint="Different entries with the same username and password."
            count={duplicates.length}
            icon={<Users className="size-4" aria-hidden />}
            tone="warning"
          >
            {duplicates.length === 0 ? (
              <EmptyRow text="No duplicates found." />
            ) : (
              <ul className="space-y-3">
                {duplicates.map((group) => (
                  <li
                    key={group.key}
                    className="rounded-md border bg-background p-3"
                  >
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {group.members.length} entries share the same credentials
                    </p>
                    <ul className="space-y-1">
                      {group.members.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => jumpTo(m.id)}
                            className="w-full rounded px-1.5 py-1 text-left text-sm hover:bg-muted"
                          >
                            <span className="font-medium">{m.title}</span>
                            {m.username && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {m.username}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </ReportSection>
        </div>

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

function ReportSection({
  title,
  hint,
  count,
  icon,
  tone,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  icon: React.ReactNode;
  tone: 'warning' | 'neutral';
  children: React.ReactNode;
}) {
  const chipColor =
    count === 0
      ? 'bg-muted text-muted-foreground'
      : tone === 'warning'
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-500'
        : 'bg-primary/15 text-primary';
  return (
    <section>
      <header className="mb-2 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${chipColor}`}
        >
          {count === 0 ? 'OK' : count}
        </span>
      </header>
      {children}
    </section>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-dashed bg-background p-3 text-center text-xs text-muted-foreground">
      {text}
    </p>
  );
}
