import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';

/**
 * List the caller's pending invites. Match is on lower-cased email so it
 * survives casing differences between the invite and the account.
 *
 * Expired invites are filtered out server-side. A separate cron trims the
 * rows themselves; here we just skip them silently.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const invites = await prisma.sharedVaultInvite.findMany({
    where: { email: user.email.toLowerCase(), expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      role: true,
      wrappedKey: true,
      createdAt: true,
      expiresAt: true,
      sharedVault: {
        select: { id: true, name: true, nameIv: true, ownerId: true },
      },
      sender: { select: { id: true, email: true } },
    },
  });

  return NextResponse.json({
    invites: invites.map((i) => ({
      id: i.id,
      role: i.role,
      wrappedKey: i.wrappedKey,
      createdAt: i.createdAt,
      expiresAt: i.expiresAt,
      vault: i.sharedVault,
      sender: i.sender,
    })),
  });
}
