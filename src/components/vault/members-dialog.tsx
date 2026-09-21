'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Link2,
  Loader2,
  Trash2,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { rsaDecrypt, rsaEncrypt, importPublicKey } from '@/lib/crypto';
import type { SharedVaultSummary } from '@/lib/vault/use-shared-vaults';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vault: SharedVaultSummary;
  /**
   * Caller's own RSA private key. Used only during owner "complete wrap"
   * flows to decrypt the vault's wrappedKey on demand, immediately re-wrap
   * for the claimant, and discard the raw bytes. The raw AES vault key
   * never lives in state.
   */
  privateKey: CryptoKey;
}

interface Member {
  id: string;
  role: 'owner' | 'editor' | 'reader';
  createdAt: string;
  user: { id: string; email: string; publicKey: string | null };
}

interface InviteLink {
  id: string;
  token: string;
  role: 'editor' | 'reader';
  createdAt: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
}

interface PendingWrap {
  id: string;
  role: 'editor' | 'reader';
  createdAt: string;
  user: { id: string; email: string; publicKey: string | null };
}

export function MembersDialog({
  open,
  onOpenChange,
  vault,
  privateKey,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80svh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" aria-hidden />
            {vault.displayName ?? 'Shared vault'}
          </DialogTitle>
          <DialogDescription>
            Manage who can access this vault. Only owners can mint invite
            links and approve new members.
          </DialogDescription>
        </DialogHeader>
        {open && <Body vault={vault} privateKey={privateKey} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({
  vault,
  privateKey,
}: {
  vault: SharedVaultSummary;
  privateKey: CryptoKey;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [links, setLinks] = useState<InviteLink[] | null>(null);
  const [pendings, setPendings] = useState<PendingWrap[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newLinkRole, setNewLinkRole] = useState<'editor' | 'reader'>('editor');

  const isOwner = vault.role === 'owner';

  const reloadAll = useCallback(async () => {
    try {
      const [m, l, p] = await Promise.all([
        fetch(`/api/vaults/${vault.id}/members`).then((r) => r.json()),
        isOwner
          ? fetch(`/api/vaults/${vault.id}/invite-links`).then((r) => r.json())
          : Promise.resolve({ links: [] }),
        isOwner
          ? fetch(`/api/vaults/${vault.id}/pending-wraps`).then((r) => r.json())
          : Promise.resolve({ pendings: [] }),
      ]);
      setError(null);
      setMembers(m.members ?? []);
      setLinks(l.links ?? []);
      setPendings(p.pendings ?? []);
    } catch {
      setError('Could not load members.');
    }
  }, [vault.id, isOwner]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, l, p] = await Promise.all([
          fetch(`/api/vaults/${vault.id}/members`).then((r) => r.json()),
          isOwner
            ? fetch(`/api/vaults/${vault.id}/invite-links`).then((r) => r.json())
            : Promise.resolve({ links: [] }),
          isOwner
            ? fetch(`/api/vaults/${vault.id}/pending-wraps`).then((r) => r.json())
            : Promise.resolve({ pendings: [] }),
        ]);
        if (cancelled) return;
        setMembers(m.members ?? []);
        setLinks(l.links ?? []);
        setPendings(p.pendings ?? []);
      } catch {
        if (!cancelled) setError('Could not load members.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vault.id, isOwner]);

  async function mintLink() {
    setBusyId('__new-link');
    setError(null);
    try {
      const res = await fetch(`/api/vaults/${vault.id}/invite-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newLinkRole }),
      });
      if (!res.ok) throw new Error();
      await reloadAll();
    } catch {
      setError('Could not create the link.');
    } finally {
      setBusyId(null);
    }
  }

  async function revokeLink(link: InviteLink) {
    setBusyId(link.id);
    try {
      const res = await fetch(
        `/api/vaults/${vault.id}/invite-links/${link.id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error();
      await reloadAll();
    } catch {
      setError('Could not revoke the link.');
    } finally {
      setBusyId(null);
    }
  }

  async function complete(pending: PendingWrap) {
    if (!pending.user.publicKey) {
      setError('That claimant has no keypair enrolled yet.');
      return;
    }
    setBusyId(pending.id);
    try {
      // On-demand: decrypt the vault's wrappedKey to raw bytes, immediately
      // re-encrypt for the claimant, then let the bytes go out of scope.
      // We never store the raw AES vault key.
      const rawKey = await rsaDecrypt(privateKey, vault.wrappedKey);
      const publicKey = await importPublicKey(pending.user.publicKey);
      const wrappedKey = await rsaEncrypt(publicKey, rawKey);
      rawKey.fill(0);
      const res = await fetch(
        `/api/vaults/${vault.id}/pending-wraps/${pending.id}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wrappedKey }),
        },
      );
      if (!res.ok) throw new Error();
      await reloadAll();
    } catch {
      setError('Could not add the member.');
    } finally {
      setBusyId(null);
    }
  }

  async function denyPending(pending: PendingWrap) {
    setBusyId(pending.id);
    try {
      const res = await fetch(
        `/api/vaults/${vault.id}/pending-wraps/${pending.id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error();
      await reloadAll();
    } catch {
      setError('Could not deny the request.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Members
        </h3>
        {!members ? (
          <Loader />
        ) : members.length === 0 ? (
          <Empty>No members yet.</Empty>
        ) : (
          <ul className="divide-y rounded-md border">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-2 p-2 text-sm">
                <UserRound className="size-4 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{m.user.email}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner && (
        <>
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <UserPlus className="size-3.5" aria-hidden /> Pending claims
            </h3>
            {!pendings ? (
              <Loader />
            ) : pendings.length === 0 ? (
              <Empty>No one is waiting on a wrap.</Empty>
            ) : (
              <ul className="divide-y rounded-md border">
                {pendings.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 p-2 text-sm">
                    <UserRound className="size-4 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{p.user.email}</p>
                      <p className="text-[10px] uppercase text-muted-foreground">
                        wants {p.role}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => complete(p)}
                      disabled={busyId === p.id || !p.user.publicKey}
                      className="gap-1"
                      title={!p.user.publicKey ? 'Claimant has no keypair yet' : undefined}
                    >
                      {busyId === p.id ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Check className="size-3.5" aria-hidden />
                      )}
                      Add
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => denyPending(p)}
                      disabled={busyId === p.id}
                      aria-label="Deny"
                      title="Deny"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Link2 className="size-3.5" aria-hidden /> Invite links
            </h3>
            <div className="mb-2 flex items-center gap-2">
              <Label htmlFor="new-link-role" className="text-xs">
                Role
              </Label>
              <select
                id="new-link-role"
                className="h-8 rounded-md border bg-transparent px-2 text-xs"
                value={newLinkRole}
                onChange={(e) =>
                  setNewLinkRole(e.target.value as 'editor' | 'reader')
                }
              >
                <option value="editor">Editor</option>
                <option value="reader">Reader</option>
              </select>
              <Button
                type="button"
                size="sm"
                onClick={mintLink}
                disabled={busyId === '__new-link'}
                className="ml-auto gap-1.5"
              >
                {busyId === '__new-link' && (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                )}
                Mint link
              </Button>
            </div>
            {!links ? (
              <Loader />
            ) : links.length === 0 ? (
              <Empty>No links yet.</Empty>
            ) : (
              <ul className="divide-y rounded-md border">
                {links.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 p-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {l.role} ·
                        </span>{' '}
                        {l.useCount}/{l.maxUses} used
                      </p>
                      <LinkUrl token={l.token} />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => revokeLink(l)}
                      disabled={busyId === l.id}
                      aria-label="Revoke"
                      title="Revoke"
                    >
                      {busyId === l.id ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="size-3.5" aria-hidden />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function LinkUrl({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}/invite/${token}`
      : `/invite/${token}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Some browsers block writeText without a user gesture — silent.
    }
  }
  return (
    <div className="flex items-center gap-1">
      <Input value={url} readOnly className="h-7 flex-1 font-mono text-xs" />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={copy}
        aria-label="Copy invite URL"
        title="Copy invite URL"
        className="text-muted-foreground"
      >
        {copied ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
      </Button>
    </div>
  );
}

function Loader() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden /> Loading...
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}
