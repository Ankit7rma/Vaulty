'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Loader2, Users } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { useVaultKey } from '@/lib/vault/vault-key-context';
import { ensureKeypair } from '@/lib/vault/keypair';

/**
 * Claim UI for /invite/[token]. Server has already made sure the caller is
 * signed in; here we:
 *   1. Fetch the preview (role, sender, remaining uses, expiry).
 *   2. If the vault is currently locked, prompt to unlock first — we need
 *      the master key to lazy-enroll the RSA keypair.
 *   3. If already a member, show a "go to vault" shortcut.
 *   4. Otherwise, ensure the keypair is enrolled, then POST the claim.
 *      Server creates a pending-wrap; the owner completes the wrap later.
 */

interface Preview {
  role: 'owner' | 'editor' | 'reader';
  expiresAt: string;
  remaining: number;
  sender: { email: string };
  vault: { id: string; name: string; nameIv: string };
}

type State =
  | { status: 'loading' }
  | { status: 'locked' }
  | { status: 'ready'; preview: Preview }
  | { status: 'already-member'; vaultId: string }
  | { status: 'already-pending' }
  | { status: 'error'; message: string; recoverable: boolean };

export function ClaimView({ token }: { token: string }) {
  const router = useRouter();
  const { key, isUnlocked } = useVaultKey();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/invite-links/${token}`, { cache: 'no-store' });
    if (res.status === 410) {
      setState({
        status: 'error',
        message: 'This invite link is no longer valid.',
        recoverable: false,
      });
      return;
    }
    if (res.status === 404) {
      setState({
        status: 'error',
        message: 'This invite link does not exist.',
        recoverable: false,
      });
      return;
    }
    if (!res.ok) {
      setState({
        status: 'error',
        message: 'Could not load the invite.',
        recoverable: true,
      });
      return;
    }
    const data = (await res.json()) as {
      link: Preview;
      already: { member: { id: string } | null; pending: { id: string } | null };
    };
    if (data.already.member) {
      setState({ status: 'already-member', vaultId: data.link.vault.id });
      return;
    }
    if (data.already.pending) {
      setState({ status: 'already-pending' });
      return;
    }
    setState({ status: 'ready', preview: data.link });
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch {
        if (!cancelled) {
          setState({
            status: 'error',
            message: 'Could not load the invite.',
            recoverable: true,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function accept() {
    if (state.status !== 'ready') return;
    if (!key) {
      setState({ status: 'locked' });
      return;
    }
    setBusy(true);
    try {
      // Ensure the caller has a public key on file before claiming; the
      // server also rejects with 409 if not, but doing it here gives a
      // clean UX.
      await ensureKeypair(key);
      const res = await fetch(`/api/invite-links/${token}/claim`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setState({
          status: 'error',
          message: data.error ?? 'Could not claim the invite.',
          recoverable: true,
        });
        return;
      }
      setState({ status: 'already-pending' });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unexpected error.',
        recoverable: true,
      });
    } finally {
      setBusy(false);
    }
  }

  // If the vault is locked when the user tries to accept, offer a direct
  // path to /unlock and come back.
  const showUnlockCta = state.status === 'locked' || (!isUnlocked && state.status === 'ready');

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-lg border p-6">
        <div className="mb-3 flex items-center gap-2">
          <Users className="size-5 text-muted-foreground" aria-hidden />
          <h1 className="text-lg font-semibold">Shared vault invite</h1>
        </div>

        {state.status === 'loading' && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Checking the link...
          </p>
        )}

        {state.status === 'ready' && (
          <>
            <p className="text-sm">
              <span className="font-medium">{state.preview.sender.email}</span>{' '}
              wants to add you as a{' '}
              <span className="font-medium">{state.preview.role}</span>. The
              vault name is encrypted and will decrypt only after the owner
              finishes wrapping the key for you.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Expires{' '}
              {new Date(state.preview.expiresAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
              . {state.preview.remaining} use
              {state.preview.remaining === 1 ? '' : 's'} left.
            </p>
            {showUnlockCta ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Unlock your vault first so we can enroll your keypair.
                </p>
                <Link
                  href={`/unlock?next=/invite/${encodeURIComponent(token)}`}
                  className={buttonVariants({ size: 'sm' }) + ' gap-1'}
                >
                  Unlock
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            ) : (
              <Button
                type="button"
                onClick={accept}
                disabled={busy}
                className="mt-4 w-full gap-1.5"
              >
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Accept invite
              </Button>
            )}
          </>
        )}

        {state.status === 'locked' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your vault is locked. Unlock to accept.
            </p>
            <Link
              href={`/unlock?next=/invite/${encodeURIComponent(token)}`}
              className={buttonVariants() + ' w-full gap-1.5'}
            >
              Unlock
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        )}

        {state.status === 'already-member' && (
          <div className="space-y-3">
            <p className="text-sm">You&rsquo;re already a member of this vault.</p>
            <Button
              type="button"
              className="w-full gap-1.5"
              onClick={() => router.push('/vault')}
            >
              Open Vaulty
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        )}

        {state.status === 'already-pending' && (
          <div className="space-y-3">
            <p className="text-sm">
              Waiting for the owner to complete the key wrap. You&rsquo;ll
              see the vault in your switcher as soon as that happens.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => router.push('/vault')}
            >
              Back to Vaulty
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        )}

        {state.status === 'error' && (
          <div className="space-y-3">
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.message}
            </p>
            {state.recoverable ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setState({ status: 'loading' });
                  load();
                }}
                className="w-full"
              >
                Retry
              </Button>
            ) : (
              <Link
                href="/vault"
                className={buttonVariants({ variant: 'outline' }) + ' w-full'}
              >
                Back to Vaulty
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
