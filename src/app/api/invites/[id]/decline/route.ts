import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { recordAudit } from '@/lib/auth/audit';

type Params = { params: Promise<{ id: string }> };

/** Decline (delete) a pending invite addressed to the caller. */
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

  const deleted = await prisma.sharedVaultInvite.deleteMany({
    where: { id, email },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  recordAudit(
    session.userId,
    'shared_vault.invite_declined',
    { inviteId: id },
    { request },
  );
  return NextResponse.json({ ok: true });
}
