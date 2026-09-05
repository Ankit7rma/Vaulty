'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Eye, EyeOff, ExternalLink, KeyRound, StickyNote } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/vault/copy-button';
import { TotpCode } from '@/components/vault/totp-code';
import { isValidTotpSecret } from '@/lib/vault/totp';
import { openShare, type SharedPayload } from '@/lib/vault/share';
import type { LoginFields, NoteFields } from '@/lib/vault/items';

type Status = 'loading' | 'error' | 'ready';

function openUrl(raw: string) {
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-sm">{value || '-'}</span>
        {children}
      </div>
    </div>
  );
}

function LoginView({ fields }: { fields: LoginFields }) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <>
      {fields.username && (
        <Row label="Username" value={fields.username}>
          <CopyButton value={fields.username} label="username" />
        </Row>
      )}
      {fields.password && (
        <Row
          label="Password"
          value={showPassword ? fields.password : '•'.repeat(10)}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
          <CopyButton value={fields.password} label="password" />
        </Row>
      )}
      {fields.url && (
        <Row label="URL" value={fields.url}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => openUrl(fields.url)}
            aria-label="Open URL in a new tab"
          >
            <ExternalLink />
          </Button>
        </Row>
      )}
      {fields.notes && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Notes</p>
          <p className="whitespace-pre-wrap text-sm">{fields.notes}</p>
        </div>
      )}
      {fields.totp && isValidTotpSecret(fields.totp) && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">One-time code</p>
          <TotpCode secret={fields.totp} />
        </div>
      )}
    </>
  );
}

export function SharedItemView({ token }: { token: string }) {
  const [status, setStatus] = useState<Status>('loading');
  const [payload, setPayload] = useState<SharedPayload | null>(null);
  // Opening a one-time share is a destructive read, so it must happen exactly
  // once. This ref guards against React StrictMode's double-invoked effect,
  // which would otherwise consume the share on the first call and 404 on the
  // second.
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    const key = window.location.hash.replace(/^#/, '');
    const run = key
      ? openShare(token, key)
      : Promise.reject(new Error('missing key'));
    run
      .then((result) => {
        setPayload(result);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        {status === 'loading' && (
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Decrypting shared item...
          </CardContent>
        )}

        {status === 'error' && (
          <CardContent className="py-12 text-center">
            <p className="font-medium">This link can&rsquo;t be opened</p>
            <p className="mt-1 text-sm text-muted-foreground">
              It may be invalid, expired, or already viewed. One-time links work
              exactly once.
            </p>
          </CardContent>
        )}

        {status === 'ready' && payload && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {payload.type === 'login' ? (
                  <KeyRound className="size-4 text-muted-foreground" />
                ) : (
                  <StickyNote className="size-4 text-muted-foreground" />
                )}
                {payload.fields.title || 'Shared item'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {payload.type === 'login' ? (
                <LoginView fields={payload.fields as LoginFields} />
              ) : (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Note</p>
                  <p className="whitespace-pre-wrap text-sm">
                    {(payload.fields as NoteFields).body || '(empty)'}
                  </p>
                </div>
              )}
              <p className="border-t pt-3 text-xs text-muted-foreground">
                Shared securely with Vaulty. This link works only once.
              </p>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
