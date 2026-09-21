import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import {
  canManage,
  getSharedVaultRole,
} from '@/lib/auth/shared-vault-access';
import { recordAudit } from '@/lib/auth/audit';

type Params = { params: Promise<{ id: string }> };

/** Fetch details of a shared vault the caller can access. */
export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const membership = await prisma.sharedVaultMembership.findUnique({
    where: { sharedVaultId_userId: { sharedVaultId: id, userId: session.userId } },
    select: {
      role: true,
      wrappedKey: true,
      sharedVault: {
        select: {
          id: true,
          name: true,
          nameIv: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({
    vault: {
      ...membership.sharedVault,
      role: membership.role,
      wrappedKey: membership.wrappedKey,
    },
  });
}

/** Delete a shared vault. Owner-only. Cascade drops items, invites, members. */
export async function DELETE(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const role = await getSharedVaultRole(session.userId, id);
  if (!role || !canManage(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await prisma.sharedVault.delete({ where: { id } });
  recordAudit(
    session.userId,
    'shared_vault.deleted',
    { vaultId: id },
    { request },
  );
  return NextResponse.json({ ok: true });
}
