'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  StickyNote,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CopyButton } from '@/components/vault/copy-button';
import { TotpCode } from '@/components/vault/totp-code';
import { isValidTotpSecret } from '@/lib/vault/totp';
import {
  decryptShare,
  fetchShare,
  type OpenedShare,
  type SharePrelude,
} from '@/lib/vault/share';
import type { LoginFields, NoteFields } from '@/lib/vault/items';

type Status = 'loading' | 'error' | 'passphrase' | 'ready';

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
  const [payload, setPayload] = useState<OpenedShare | null>(null);
  const [prelude, setPrelude] = useState<SharePrelude | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const keyRef = useRef<string>('');
  // fetchShare consumes a view server-side, so it must run exactly once.
  // StrictMode double-invokes effects; this ref guards against that.
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    const key = window.location.hash.replace(/^#/, '');
    keyRef.current = key;

    // Missing key => URL fragment was stripped or never set. Fail fast
    // without hitting the server so we don't consume a view on a broken link.
    const run = key
      ? fetchShare(token)
      : Promise.reject(new Error('missing key'));
    run
      .then(async (p) => {
        setPrelude(p);
        if (p.passSalt) {
          setStatus('passphrase');
          return;
        }
        const opened = await decryptShare(p, key);
        setPayload(opened);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  async function tryPassphrase(event: React.FormEvent) {
    event.preventDefault();
    if (!prelude) return;
    setPassError(null);
    setDecrypting(true);
    try {
      const opened = await decryptShare(prelude, keyRef.current, passphrase);
      setPayload(opened);
      setStatus('ready');
    } catch {
      setPassError('Wrong passphrase.');
    } finally {
      setDecrypting(false);
    }
  }

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
              It may be invalid, expired, or already fully consumed.
            </p>
          </CardContent>
        )}

        {status === 'passphrase' && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="size-4 text-muted-foreground" aria-hidden />
                Passphrase required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={tryPassphrase} className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  The sender protected this share with a passphrase. Enter it
                  to decrypt the item locally.
                </p>
                <Input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Passphrase"
                  autoFocus
                  aria-label="Passphrase"
                />
                {passError && (
                  <p className="text-sm text-destructive" role="alert">
                    {passError}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={decrypting || passphrase.length === 0}
                  className="w-full gap-1.5"
                >
                  {decrypting && (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  )}
                  Decrypt
                </Button>
              </form>
            </CardContent>
          </>
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
              {payload.note && (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                  <p className="mb-1 text-xs font-medium text-primary">
                    Message from the sender
                  </p>
                  <p className="text-sm whitespace-pre-wrap">
                    {payload.note}
                  </p>
                </div>
              )}
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
                Shared securely with Vaulty.{' '}
                {payload.remaining === 0
                  ? 'This link has now self-destructed.'
                  : `${payload.remaining} view${payload.remaining === 1 ? '' : 's'} remaining.`}
              </p>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
