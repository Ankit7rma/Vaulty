import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { recordAudit } from '@/lib/auth/audit';

type Params = { params: Promise<{ id: string }> };

/** Optional label ciphertext + iv attached to a manual checkpoint. */
const pinInputSchema = z
  .object({
    label: z.string().min(1).max(10_000).optional(),
    labelIv: z.string().min(1).max(200).optional(),
  })
  .refine((v) => (v.label == null) === (v.labelIv == null), {
    message: 'label and labelIv must be set together',
  });

/**
 * Prior versions of an item, newest first. Returns encrypted blobs only; the
 * client decrypts with the vault key it already holds in memory. `pinned`
 * marks manual checkpoints so the client can distinguish them from auto
 * snapshots and offer a delete option only on the pinned ones.
 */
export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  const owns = await prisma.vaultItem.findFirst({
    where: { id, userId: session.userId },
    select: { id: true },
  });
  if (!owns) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const versions = await prisma.vaultItemHistory.findMany({
    where: { itemId: id },
    orderBy: [{ pinned: 'desc' }, { savedAt: 'desc' }],
    select: {
      id: true,
      type: true,
      cipher: true,
      iv: true,
      savedAt: true,
      pinned: true,
      label: true,
      labelIv: true,
    },
  });

  return NextResponse.json({ versions });
}

/**
 * Manual "Save version" checkpoint. Snapshots the item's current ciphertext
 * (whatever's currently persisted) as a pinned history row so it survives
 * the auto-prune. Optional label is a client-encrypted string stored in the
 * same way item titles are — the server never learns what it says.
 */
export async function POST(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = pinInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid label' }, { status: 400 });
  }

  const current = await prisma.vaultItem.findFirst({
    where: { id, userId: session.userId },
    select: { id: true, type: true, cipher: true, iv: true },
  });
  if (!current) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const version = await prisma.vaultItemHistory.create({
    data: {
      itemId: current.id,
      type: current.type,
      cipher: current.cipher,
      iv: current.iv,
      pinned: true,
      label: parsed.data.label ?? null,
      labelIv: parsed.data.labelIv ?? null,
    },
    select: {
      id: true,
      savedAt: true,
      pinned: true,
      label: true,
      labelIv: true,
    },
  });
  recordAudit(
    session.userId,
    'item.checkpoint_saved',
    { itemId: current.id, versionId: version.id },
    { request },
  );
  return NextResponse.json({ version }, { status: 201 });
}
