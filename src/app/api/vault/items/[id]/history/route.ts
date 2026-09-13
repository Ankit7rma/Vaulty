import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';

type Params = { params: Promise<{ id: string }> };

/**
 * Prior versions of an item, newest first. Returns encrypted blobs only; the
 * client decrypts with the vault key it already holds in memory.
 */
export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  // Verify the caller owns the item; the ownership check lives on VaultItem,
  // not VaultItemHistory, so we join before returning.
  const owns = await prisma.vaultItem.findFirst({
    where: { id, userId: session.userId },
    select: { id: true },
  });
  if (!owns) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const versions = await prisma.vaultItemHistory.findMany({
    where: { itemId: id },
    orderBy: { savedAt: 'desc' },
    select: {
      id: true,
      type: true,
      cipher: true,
      iv: true,
      savedAt: true,
    },
  });

  return NextResponse.json({ versions });
}
