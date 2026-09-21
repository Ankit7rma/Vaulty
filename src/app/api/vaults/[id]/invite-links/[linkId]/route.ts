import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import {
  canManage,
  getSharedVaultRole,
} from '@/lib/auth/shared-vault-access';
import { recordAudit } from '@/lib/auth/audit';

type Params = { params: Promise<{ id: string; linkId: string }> };

/**
 * Revoke an invite link. Any pending-wrap rows produced from this link keep
 * their sourceLinkId set to null (ON DELETE SET NULL), so claims already
 * in flight stay valid and the owner can still complete or deny them —
 * revoking only prevents new claims.
 */
export async function DELETE(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id, linkId } = await params;
  const role = await getSharedVaultRole(session.userId, id);
  if (!role || !canManage(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const deleted = await prisma.sharedVaultInviteLink.deleteMany({
    where: { id: linkId, sharedVaultId: id },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  recordAudit(
    session.userId,
    'shared_vault.invite_link_revoked',
    { vaultId: id, linkId },
    { request },
  );
  return NextResponse.json({ ok: true });
}
