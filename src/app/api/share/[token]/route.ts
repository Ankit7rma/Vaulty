import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type Params = { params: Promise<{ token: string }> };

/**
 * Fetches a shared item exactly once. The row is deleted atomically as part of
 * reading it (prisma.delete), so a second open - or an expired link - 404s.
 * Public by design: the recipient does not need an account, and the server
 * still cannot read the payload (the key is only in the caller's URL fragment).
 */
export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;

  let share;
  try {
    share = await prisma.share.delete({
      where: { token },
      select: { cipher: true, iv: true, expiresAt: true },
    });
  } catch {
    // No row with this token (never existed, or already opened).
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (share.expiresAt < new Date()) {
    // Expired: it is now also deleted, which is the cleanup we want.
    return NextResponse.json({ error: 'Expired' }, { status: 410 });
  }

  return NextResponse.json(
    { cipher: share.cipher, iv: share.iv },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
