import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import {
  canManage,
  getSharedVaultRole,
} from '@/lib/auth/shared-vault-access';

type Params = { params: Promise<{ id: string }> };

/**
 * List pending wraps for a shared vault. Each entry surfaces the claimant's
 * email + public key so the owner (client) can wrap the vault key against
 * them and complete the flow.
 */
export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const role = await getSharedVaultRole(session.userId, id);
  if (!role || !canManage(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const pendings = await prisma.sharedVaultPendingWrap.findMany({
    where: { sharedVaultId: id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      role: true,
      createdAt: true,
      sourceLinkId: true,
      user: {
        select: { id: true, email: true, publicKey: true, keypairAlg: true },
      },
    },
  });
  return NextResponse.json({ pendings });
}
