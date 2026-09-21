import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import {
  canManage,
  getSharedVaultRole,
} from '@/lib/auth/shared-vault-access';
import { rotateOnRemovalSchema } from '@/lib/vault/schemas';
import { recordAudit } from '@/lib/auth/audit';

type Params = { params: Promise<{ id: string; memberId: string }> };

const patchSchema = z.object({
  role: z.enum(['editor', 'reader']),
});

/**
 * Change a non-owner's role. Owner-only. Owner role cannot be assigned
 * through this endpoint — ownership transfer is a separate flow that also
 * demotes the previous owner atomically.
 */
export async function PATCH(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id, memberId } = await params;
  const role = await getSharedVaultRole(session.userId, id);
  if (!role || !canManage(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const target = await prisma.sharedVaultMembership.findFirst({
    where: { id: memberId, sharedVaultId: id },
    select: { id: true, role: true, userId: true },
  });
  if (!target) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (target.role === 'owner') {
    return NextResponse.json(
      { error: 'Use transfer-ownership to change an owner.' },
      { status: 409 },
    );
  }

  await prisma.sharedVaultMembership.update({
    where: { id: memberId },
    data: { role: parsed.data.role },
  });
  recordAudit(
    session.userId,
    'shared_vault.role_changed',
    { vaultId: id, memberId, role: parsed.data.role },
    { request },
  );
  return NextResponse.json({ ok: true });
}

/**
 * Remove a member AND rotate the vault key in one atomic operation. The
 * departing member still holds the old key in memory, so we treat "remove"
 * as revocation: from now on the server holds ciphertext they cannot decrypt
 * anymore. The client has already:
 *   - generated a fresh vault key
 *   - re-encrypted every item under it
 *   - wrapped it with every remaining member's public key
 *
 * The server verifies: caller is owner, target is a non-owner member, the
 * remaining-member id set matches the caller's wrappedKeys, and the item id
 * set matches the vault's items. All updates run in one transaction so the
 * key change is atomic; version history is wiped because those rows are
 * encrypted under the dead key.
 */
export async function DELETE(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id, memberId } = await params;
  const role = await getSharedVaultRole(session.userId, id);
  if (!role || !canManage(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = rotateOnRemovalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid rotation payload' }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const target = await tx.sharedVaultMembership.findFirst({
        where: { id: memberId, sharedVaultId: id },
        select: { id: true, userId: true, role: true },
      });
      if (!target) throw new RemovalError('Not found', 404);
      if (target.role === 'owner') {
        throw new RemovalError('Cannot remove the owner.', 409);
      }
      if (target.userId === session.userId) {
        throw new RemovalError('Use leave to remove yourself.', 409);
      }

      const remaining = await tx.sharedVaultMembership.findMany({
        where: { sharedVaultId: id, NOT: { id: memberId } },
        select: { id: true, userId: true },
      });
      const remainingIds = new Set(remaining.map((m) => m.userId));
      const payloadIds = new Set(parsed.data.wrappedKeys.map((k) => k.userId));
      if (remainingIds.size !== payloadIds.size) {
        throw new RemovalError('Wrapped-key set does not match members.', 409);
      }
      for (const uid of remainingIds) {
        if (!payloadIds.has(uid)) {
          throw new RemovalError('Missing wrapped key for a member.', 409);
        }
      }

      const items = await tx.vaultItem.findMany({
        where: { sharedVaultId: id },
        select: { id: true },
      });
      const itemIds = new Set(items.map((i) => i.id));
      const payloadItemIds = new Set(parsed.data.items.map((i) => i.id));
      if (itemIds.size !== payloadItemIds.size) {
        throw new RemovalError('Item set changed during rotation.', 409);
      }
      for (const iid of itemIds) {
        if (!payloadItemIds.has(iid)) {
          throw new RemovalError('Missing rewrapped item.', 409);
        }
      }

      // Drop the target first so their old wrappedKey row disappears with
      // the same transaction that installs the new one for everyone else.
      await tx.sharedVaultMembership.delete({ where: { id: target.id } });

      for (const wk of parsed.data.wrappedKeys) {
        await tx.sharedVaultMembership.update({
          where: {
            sharedVaultId_userId: { sharedVaultId: id, userId: wk.userId },
          },
          data: { wrappedKey: wk.wrappedKey },
        });
      }

      for (const item of parsed.data.items) {
        await tx.vaultItem.update({
          where: { id: item.id },
          data: { cipher: item.cipher, iv: item.iv },
        });
      }

      // History rows are encrypted with the old key. Drop them.
      await tx.vaultItemHistory.deleteMany({
        where: { item: { sharedVaultId: id } },
      });
    });
  } catch (error) {
    if (error instanceof RemovalError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  recordAudit(
    session.userId,
    'shared_vault.member_removed',
    { vaultId: id, memberId, itemCount: parsed.data.items.length },
    { request },
  );
  return NextResponse.json({ ok: true });
}

class RemovalError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'RemovalError';
  }
}
