import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import {
  canManage,
  getSharedVaultRole,
} from '@/lib/auth/shared-vault-access';
import { recordAudit } from '@/lib/auth/audit';

type Params = { params: Promise<{ id: string; inviteId: string }> };

/** Cancel a pending invite before it has been accepted. Owner-only. */
export async function DELETE(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id, inviteId } = await params;
  const role = await getSharedVaultRole(session.userId, id);
  if (!role || !canManage(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const deleted = await prisma.sharedVaultInvite.deleteMany({
    where: { id: inviteId, sharedVaultId: id },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  recordAudit(
    session.userId,
    'shared_vault.invite_cancelled',
    { vaultId: id, inviteId },
    { request },
  );
  return NextResponse.json({ ok: true });
}
