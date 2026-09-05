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

type Params = { params: Promise<{ id: string }> };

/** Replace an item's encrypted blob. Scoped to the owner. */
export async function PUT(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

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

  // updateMany with the userId filter is the ownership check in one query.
  const result = await prisma.vaultItem.updateMany({
    where: { id, userId: session.userId },
    data: parsed.data,
  });
  if (result.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const item = await prisma.vaultItem.findUnique({
    where: { id },
    select: ITEM_SELECT,
  });
  return NextResponse.json({ item });
}

/** Delete an item. Scoped to the owner. */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  const result = await prisma.vaultItem.deleteMany({
    where: { id, userId: session.userId },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
