import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';

/** Recent audit events for the current user (newest first, capped at 200). */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const events = await prisma.auditEvent.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      event: true,
      meta: true,
      ipHash: true,
      userAgent: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ events });
}
