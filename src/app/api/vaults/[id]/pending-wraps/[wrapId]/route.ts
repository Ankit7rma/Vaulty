import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import {
  canManage,
  getSharedVaultRole,
} from '@/lib/auth/shared-vault-access';
import { recordAudit } from '@/lib/auth/audit';

type Params = { params: Promise<{ id: string; wrapId: string }> };

/**
 * Owner denies a pending wrap. Removes the row so the claimant no longer
 * appears as pending; the recipient can re-claim the same link later if it
 * is still valid and they haven't burned it (uniqueness is on
 * (vaultId, userId), so deletion frees the slot).
 */
export async function DELETE(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id, wrapId } = await params;
  const role = await getSharedVaultRole(session.userId, id);
  if (!role || !canManage(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const deleted = await prisma.sharedVaultPendingWrap.deleteMany({
    where: { id: wrapId, sharedVaultId: id },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  recordAudit(
    session.userId,
    'shared_vault.pending_wrap_denied',
    { vaultId: id, wrapId },
    { request },
  );
  return NextResponse.json({ ok: true });
}
