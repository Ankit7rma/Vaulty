import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { itemInputSchema } from '@/lib/vault/schemas';

const ITEM_SELECT = {
  id: true,
  type: true,
  cipher: true,
  iv: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** List the caller's items (opaque blobs; decryption happens client-side). */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const items = await prisma.vaultItem.findMany({
    where: { userId: session.userId },
    select: ITEM_SELECT,
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json({ items });
}

/** Create an item from a client-encrypted blob. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = itemInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
  }

  const item = await prisma.vaultItem.create({
    data: { userId: session.userId, ...parsed.data },
    select: ITEM_SELECT,
  });
  return NextResponse.json({ item }, { status: 201 });
}
