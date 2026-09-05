import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';

/**
 * Returns the KDF descriptor + check blob needed to derive and verify the vault
 * key on unlock. All of it is safe to send: the salt is public by design and
 * the check blob is opaque ciphertext. The master password and key never appear.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      kdfSalt: true,
      kdfName: true,
      kdfParams: true,
      verifyBlob: true,
      verifyIv: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!user.kdfSalt || !user.kdfName || !user.verifyBlob || !user.verifyIv) {
    return NextResponse.json({ error: 'Not onboarded' }, { status: 409 });
  }

  return NextResponse.json({
    kdfSalt: user.kdfSalt,
    kdfName: user.kdfName,
    kdfParams: user.kdfParams,
    verifyBlob: user.verifyBlob,
    verifyIv: user.verifyIv,
  });
}
