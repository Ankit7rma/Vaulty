import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { itemInputSchema } from '@/lib/vault/schemas';
import {
  canWrite,
  getSharedVaultRole,
} from '@/lib/auth/shared-vault-access';

type Params = { params: Promise<{ id: string; itemId: string }> };

const ITEM_SELECT = {
  id: true,
  type: true,
  cipher: true,
  iv: true,
  sharedVaultId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const HISTORY_KEEP = 10;

/**
 * Update or delete an item that belongs to a shared vault. Membership +
 * writer role are enforced; ownership of the row is irrelevant here because
 * every member with a writer role owns the vault's contents collectively.
 *
 * History is snapshotted for the whole vault the same way personal items do,
 * so undo works for shared items too. Snapshot rows carry the same
 * ciphertext (encrypted under the vault key), not the plaintext, so the
 * server still learns nothing.
 */
export async function PUT(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id, itemId } = await params;
  const role = await getSharedVaultRole(session.userId, id);
  if (!role) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!canWrite(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

  const item = await prisma.$transaction(async (tx) => {
    const current = await tx.vaultItem.findFirst({
      where: { id: itemId, sharedVaultId: id },
      select: { id: true, type: true, cipher: true, iv: true },
    });
    if (!current) return null;

    await tx.vaultItemHistory.create({
      data: {
        itemId: current.id,
        type: current.type,
        cipher: current.cipher,
        iv: current.iv,
      },
    });

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

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id, itemId } = await params;
  const role = await getSharedVaultRole(session.userId, id);
  if (!role) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!canWrite(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const result = await prisma.vaultItem.deleteMany({
    where: { id: itemId, sharedVaultId: id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
