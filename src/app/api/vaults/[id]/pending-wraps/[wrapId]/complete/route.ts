import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import {
  canManage,
  getSharedVaultRole,
} from '@/lib/auth/shared-vault-access';
import { completePendingWrapSchema } from '@/lib/vault/schemas';
import { recordAudit } from '@/lib/auth/audit';

type Params = { params: Promise<{ id: string; wrapId: string }> };

/**
 * Owner completes a pending wrap by supplying the vault key wrapped with
 * the claimant's public key. In one transaction: create the membership
 * (with the ciphertext), delete the pending-wrap row. The wrappedKey is
 * generated CLIENT-SIDE by the owner using @/lib/crypto RSA helpers; the
 * server only stores the ciphertext.
 */
export async function POST(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id, wrapId } = await params;
  const role = await getSharedVaultRole(session.userId, id);
  if (!role || !canManage(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = completePendingWrapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const membership = await prisma.$transaction(async (tx) => {
      const pending = await tx.sharedVaultPendingWrap.findFirst({
        where: { id: wrapId, sharedVaultId: id },
        select: { id: true, userId: true, role: true },
      });
      if (!pending) throw new CompleteError('Not found', 404);

      // Guard against a concurrent membership having been created some
      // other way. Uniqueness on (vaultId, userId) would raise P2002 but a
      // friendly error is clearer.
      const already = await tx.sharedVaultMembership.findUnique({
        where: {
          sharedVaultId_userId: {
            sharedVaultId: id,
            userId: pending.userId,
          },
        },
        select: { id: true },
      });
      if (already) {
        await tx.sharedVaultPendingWrap.delete({ where: { id: pending.id } });
        throw new CompleteError('User is already a member.', 409);
      }

      const created = await tx.sharedVaultMembership.create({
        data: {
          sharedVaultId: id,
          userId: pending.userId,
          role: pending.role,
          wrappedKey: parsed.data.wrappedKey,
        },
        select: { id: true, userId: true, role: true },
      });
      await tx.sharedVaultPendingWrap.delete({ where: { id: pending.id } });
      return created;
    });
    recordAudit(
      session.userId,
      'shared_vault.pending_wrap_completed',
      { vaultId: id, wrapId, memberId: membership.id },
      { request },
    );
    return NextResponse.json({ membership });
  } catch (error) {
    if (error instanceof CompleteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

class CompleteError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'CompleteError';
  }
}
