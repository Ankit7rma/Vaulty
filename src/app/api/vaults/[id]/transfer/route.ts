import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import {
  canManage,
  getSharedVaultRole,
} from '@/lib/auth/shared-vault-access';
import { recordAudit } from '@/lib/auth/audit';

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  // memberId of the target's SharedVaultMembership row. Must already be a
  // member — a transfer never invites; use the invite flow first.
  targetMemberId: z.string().min(1).max(64),
  // Role the outgoing owner takes after handoff. Defaults to editor.
  demoteTo: z.enum(['editor', 'reader']).optional(),
});

/**
 * Hand a shared vault to another existing member. The vault key does NOT
 * rotate — both parties already have it wrapped for their own keypair. Only
 * the role assignments change, atomically in one transaction so at no point
 * do zero or two members hold the owner role.
 *
 * The vault's ownerId column on the SharedVault row is updated in the same
 * transaction to stay consistent with the membership rows.
 */
export async function POST(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid transfer' }, { status: 400 });
  }
  const demoteTo = parsed.data.demoteTo ?? 'editor';

  try {
    await prisma.$transaction(async (tx) => {
      const target = await tx.sharedVaultMembership.findFirst({
        where: { id: parsed.data.targetMemberId, sharedVaultId: id },
        select: { id: true, userId: true, role: true },
      });
      if (!target) throw new TransferError('Target is not a member.', 404);
      if (target.userId === session.userId) {
        throw new TransferError('Pick a different member.', 400);
      }

      // Demote the outgoing owner first so we never have two owners visible.
      // Ordering matters: the DB constraint on unique (vaultId, userId) still
      // holds either way, but a reader that races between the two updates
      // should see one owner or the other, never both.
      await tx.sharedVaultMembership.update({
        where: {
          sharedVaultId_userId: {
            sharedVaultId: id,
            userId: session.userId,
          },
        },
        data: { role: demoteTo },
      });
      await tx.sharedVaultMembership.update({
        where: { id: target.id },
        data: { role: 'owner' },
      });
      await tx.sharedVault.update({
        where: { id },
        data: { ownerId: target.userId },
      });
    });
  } catch (error) {
    if (error instanceof TransferError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  recordAudit(
    session.userId,
    'shared_vault.ownership_transferred',
    { vaultId: id, targetMembershipId: parsed.data.targetMemberId, demoteTo },
    { request },
  );
  return NextResponse.json({ ok: true });
}

class TransferError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'TransferError';
  }
}
