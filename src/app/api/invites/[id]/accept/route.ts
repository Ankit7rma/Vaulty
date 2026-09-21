import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { recordAudit } from '@/lib/auth/audit';

type Params = { params: Promise<{ id: string }> };

/**
 * Accept a pending invite. Verifies the invite matches the caller's email
 * (case-insensitive) and has not expired, then in one transaction creates
 * the SharedVaultMembership (with the same wrappedKey the inviter stored)
 * and deletes the invite so the same one can't be accepted twice.
 */
export async function POST(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const email = user.email.toLowerCase();

  try {
    const membership = await prisma.$transaction(async (tx) => {
      const invite = await tx.sharedVaultInvite.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          role: true,
          wrappedKey: true,
          sharedVaultId: true,
          expiresAt: true,
        },
      });
      if (!invite) throw new InviteError('Invite not found', 404);
      if (invite.email.toLowerCase() !== email) {
        // Don't leak that it exists to the wrong recipient.
        throw new InviteError('Invite not found', 404);
      }
      if (invite.expiresAt <= new Date()) {
        // Also delete on expiry-hit so it doesn't linger.
        await tx.sharedVaultInvite.delete({ where: { id: invite.id } });
        throw new InviteError('Invite has expired', 410);
      }

      const created = await tx.sharedVaultMembership.create({
        data: {
          sharedVaultId: invite.sharedVaultId,
          userId: session.userId,
          role: invite.role,
          wrappedKey: invite.wrappedKey,
        },
        select: {
          id: true,
          sharedVaultId: true,
          role: true,
          wrappedKey: true,
        },
      });
      await tx.sharedVaultInvite.delete({ where: { id: invite.id } });
      return created;
    });

    recordAudit(
      session.userId,
      'shared_vault.invite_accepted',
      { vaultId: membership.sharedVaultId },
      { request },
    );
    return NextResponse.json({ membership });
  } catch (error) {
    if (error instanceof InviteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

class InviteError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'InviteError';
  }
}
