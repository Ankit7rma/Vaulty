import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { getSharedVaultRole } from '@/lib/auth/shared-vault-access';
import { recordAudit } from '@/lib/auth/audit';

type Params = { params: Promise<{ id: string }> };

/**
 * Leave a shared vault. Any non-owner member can leave; an owner must
 * transfer ownership first because a vault with no owner has no one who can
 * manage members or delete it.
 *
 * Leaving does NOT rotate the vault key. The departing member still holds it
 * in memory (they had access up until now), so treat this as a "please stop
 * showing it to me" operation rather than a revocation. If revocation is the
 * goal, the owner should remove the member which triggers key rotation.
 */
export async function POST(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const role = await getSharedVaultRole(session.userId, id);
  if (!role) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (role === 'owner') {
    return NextResponse.json(
      { error: 'Transfer ownership before leaving.' },
      { status: 409 },
    );
  }
  await prisma.sharedVaultMembership.delete({
    where: {
      sharedVaultId_userId: { sharedVaultId: id, userId: session.userId },
    },
  });
  recordAudit(
    session.userId,
    'shared_vault.left',
    { vaultId: id },
    { request },
  );
  return NextResponse.json({ ok: true });
}
