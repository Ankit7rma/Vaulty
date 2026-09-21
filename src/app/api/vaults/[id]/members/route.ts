import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { getSharedVaultRole } from '@/lib/auth/shared-vault-access';

type Params = { params: Promise<{ id: string }> };

/** List members of a shared vault. Any member can see who else is in. */
export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const role = await getSharedVaultRole(session.userId, id);
  if (!role) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const members = await prisma.sharedVaultMembership.findMany({
    where: { sharedVaultId: id },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, email: true } },
    },
  });
  return NextResponse.json({ members });
}
