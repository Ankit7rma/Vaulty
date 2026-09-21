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

const HISTORY_KEEP = 10;

type Params = { params: Promise<{ id: string }> };

/**
 * Replace an item's encrypted blob. Snapshots the pre-update ciphertext into
 * VaultItemHistory before overwriting so the user can restore prior versions,
 * and caps history at HISTORY_KEEP entries per item to bound growth.
 */
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

  const item = await prisma.$transaction(async (tx) => {
    // Ownership check + fetch the current state in one query.
    const current = await tx.vaultItem.findFirst({
      where: { id, userId: session.userId },
      select: { id: true, type: true, cipher: true, iv: true },
    });
    if (!current) return null;

    // Snapshot the current version before overwriting.
    await tx.vaultItemHistory.create({
      data: {
        itemId: current.id,
        type: current.type,
        cipher: current.cipher,
        iv: current.iv,
      },
    });

    // Prune to the most recent HISTORY_KEEP UNPINNED entries. Pinned rows
    // are manual checkpoints and stay across many auto edits. Simple two-
    // query prune is fine (10 rows per item cap); a windowed DELETE would
    // need raw SQL.
    const olderIds = (
      await tx.vaultItemHistory.findMany({
        where: { itemId: current.id, pinned: false },
        orderBy: { savedAt: 'desc' },
        skip: HISTORY_KEEP,
        select: { id: true },
      })
    ).map((r) => r.id);
    if (olderIds.length > 0) {
      await tx.vaultItemHistory.deleteMany({ where: { id: { in: olderIds } } });
    }

    return tx.vaultItem.update({
      where: { id: current.id },
      data: parsed.data,
      select: ITEM_SELECT,
    });
  });

  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
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
