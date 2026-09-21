import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';

type Params = { params: Promise<{ token: string }> };

/**
 * Preview an invite link. Requires an authenticated session so link tokens
 * can't be silently probed by anyone with the URL; the token itself is
 * random enough that guessing is infeasible, but we still don't expose
 * whether it exists to unauthenticated callers.
 *
 * Returns the vault's encrypted display name so the client can decrypt
 * ONLY once the caller has a membership. Before claim, the encrypted name
 * is useless to a stranger (they don't have the vault key), which is fine.
 */
export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { token } = await params;

  const link = await prisma.sharedVaultInviteLink.findUnique({
    where: { token },
    select: {
      id: true,
      role: true,
      expiresAt: true,
      maxUses: true,
      useCount: true,
      sharedVault: { select: { id: true, name: true, nameIv: true } },
      sender: { select: { email: true } },
    },
  });
  if (!link) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (link.expiresAt <= new Date()) {
    return NextResponse.json({ error: 'Expired' }, { status: 410 });
  }
  if (link.useCount >= link.maxUses) {
    return NextResponse.json({ error: 'Fully used' }, { status: 410 });
  }

  const existingMember = await prisma.sharedVaultMembership.findUnique({
    where: {
      sharedVaultId_userId: {
        sharedVaultId: link.sharedVault.id,
        userId: session.userId,
      },
    },
    select: { id: true, role: true },
  });
  const existingPending = existingMember
    ? null
    : await prisma.sharedVaultPendingWrap.findUnique({
        where: {
          sharedVaultId_userId: {
            sharedVaultId: link.sharedVault.id,
            userId: session.userId,
          },
        },
        select: { id: true },
      });

  return NextResponse.json({
    link: {
      role: link.role,
      expiresAt: link.expiresAt,
      remaining: link.maxUses - link.useCount,
      sender: link.sender,
      vault: link.sharedVault,
    },
    already: {
      member: existingMember,
      pending: existingPending,
    },
  });
}
