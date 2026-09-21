import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { itemInputSchema } from '@/lib/vault/schemas';
import {
  canWrite,
  getSharedVaultRole,
} from '@/lib/auth/shared-vault-access';

type Params = { params: Promise<{ id: string }> };

const ITEM_SELECT = {
  id: true,
  type: true,
  cipher: true,
  iv: true,
  sharedVaultId: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Items inside a shared vault. Membership is required to list; writer role
 * is required to create. All items are encrypted under the vault's symmetric
 * key (never seen by the server) — the row still stores userId of whoever
 * last touched it so audit can attribute writes.
 */
export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const role = await getSharedVaultRole(session.userId, id);
  if (!role) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const items = await prisma.vaultItem.findMany({
    where: { sharedVaultId: id },
    select: ITEM_SELECT,
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json({ items });
}

export async function POST(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
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

  const item = await prisma.vaultItem.create({
    data: {
      userId: session.userId,
      sharedVaultId: id,
      ...parsed.data,
    },
    select: ITEM_SELECT,
  });
  return NextResponse.json({ item }, { status: 201 });
}
