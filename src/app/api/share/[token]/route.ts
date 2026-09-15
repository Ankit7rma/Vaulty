import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';

type Params = { params: Promise<{ token: string }> };

/**
 * Fetches a shared item. Each call increments viewCount inside a transaction
 * so two concurrent readers cannot both squeeze past a maxViews=1 gate. When
 * viewCount reaches maxViews the row is deleted in the same transaction so
 * later reads always 404. Expired rows are also deleted on first access.
 *
 * Public by design: the recipient does not need an account, and the server
 * still cannot read the payload (the key is only in the caller's URL fragment).
 */
export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;

  const result = await prisma.$transaction(async (tx) => {
    const share = await tx.share.findUnique({
      where: { token },
      select: {
        id: true,
        cipher: true,
        iv: true,
        expiresAt: true,
        viewCount: true,
        maxViews: true,
        passSalt: true,
      },
    });
    if (!share) return { status: 'missing' as const };
    if (share.expiresAt < new Date()) {
      await tx.share.delete({ where: { id: share.id } });
      return { status: 'expired' as const };
    }
    const nextCount = share.viewCount + 1;
    if (nextCount >= share.maxViews) {
      // Last view: return the ciphertext then delete the row atomically.
      await tx.share.delete({ where: { id: share.id } });
      return {
        status: 'ok' as const,
        cipher: share.cipher,
        iv: share.iv,
        passSalt: share.passSalt,
        remaining: 0,
      };
    }
    await tx.share.update({
      where: { id: share.id },
      data: { viewCount: nextCount },
    });
    return {
      status: 'ok' as const,
      cipher: share.cipher,
      iv: share.iv,
      passSalt: share.passSalt,
      remaining: share.maxViews - nextCount,
    };
  });

  if (result.status === 'missing') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (result.status === 'expired') {
    return NextResponse.json({ error: 'Expired' }, { status: 410 });
  }
  return NextResponse.json(
    {
      cipher: result.cipher,
      iv: result.iv,
      remaining: result.remaining,
      passSalt: result.passSalt,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * Revokes an active share. Only the user who created it can revoke; the check
 * lives in the deleteMany filter so a missing / stranger-owned token returns
 * a plain 404.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { token } = await params;
  const result = await prisma.share.deleteMany({
    where: { token, createdBy: session.userId },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
