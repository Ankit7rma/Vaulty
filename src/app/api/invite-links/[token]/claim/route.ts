import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { recordAudit } from '@/lib/auth/audit';
import { rateLimit } from '@/lib/rate-limit';

type Params = { params: Promise<{ token: string }> };

/**
 * Claim an invite link. The caller must be authenticated AND have already
 * enrolled a keypair (client-side: the app's ensureKeypair() flow makes this
 * automatic on next unlock, but the server still checks so a broken client
 * cannot leave a claim without a public key to wrap against).
 *
 * On success: increments the link's useCount, creates a
 * SharedVaultPendingWrap for this user, and lets the owner complete the
 * wrap later. If a membership or pending-wrap already exists for this user
 * on this vault, the claim is a no-op success — the recipient re-following
 * the link should not error.
 */
export async function POST(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { token } = await params;

  const limit = await rateLimit(request, {
    name: 'invite-links.claim',
    limit: 30,
    windowSeconds: 60 * 60,
    identifier: session.userId,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetSeconds) } },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { publicKey: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!user.publicKey) {
    return NextResponse.json(
      { error: 'Enroll a keypair before claiming a shared-vault invite.' },
      { status: 409 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const link = await tx.sharedVaultInviteLink.findUnique({
        where: { token },
        select: {
          id: true,
          sharedVaultId: true,
          role: true,
          expiresAt: true,
          maxUses: true,
          useCount: true,
        },
      });
      if (!link) throw new ClaimError('Not found', 404);
      if (link.expiresAt <= new Date()) throw new ClaimError('Expired', 410);
      if (link.useCount >= link.maxUses) {
        throw new ClaimError('Fully used', 410);
      }

      const alreadyMember = await tx.sharedVaultMembership.findUnique({
        where: {
          sharedVaultId_userId: {
            sharedVaultId: link.sharedVaultId,
            userId: session.userId,
          },
        },
        select: { id: true },
      });
      if (alreadyMember) {
        return { pending: null as null | { id: string } };
      }
      const alreadyPending = await tx.sharedVaultPendingWrap.findUnique({
        where: {
          sharedVaultId_userId: {
            sharedVaultId: link.sharedVaultId,
            userId: session.userId,
          },
        },
        select: { id: true },
      });
      if (alreadyPending) {
        return { pending: alreadyPending };
      }

      const pending = await tx.sharedVaultPendingWrap.create({
        data: {
          sharedVaultId: link.sharedVaultId,
          userId: session.userId,
          role: link.role,
          sourceLinkId: link.id,
        },
        select: { id: true },
      });
      await tx.sharedVaultInviteLink.update({
        where: { id: link.id },
        data: { useCount: { increment: 1 } },
      });
      return { pending };
    });

    recordAudit(
      session.userId,
      'shared_vault.invite_link_claimed',
      { token, pendingWrapId: result.pending?.id ?? null },
      { request },
    );
    return NextResponse.json({ ok: true, pendingWrapId: result.pending?.id ?? null });
  } catch (error) {
    if (error instanceof ClaimError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

class ClaimError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ClaimError';
  }
}
