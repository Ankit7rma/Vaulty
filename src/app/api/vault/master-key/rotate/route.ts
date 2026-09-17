import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { verifyAccountPassword } from '@/lib/auth/password';
import { rotateMasterKeySchema } from '@/lib/vault/schemas';
import { recordAudit } from '@/lib/auth/audit';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Rotate the master key. Client-side has already:
 *   - Verified the current master password against the stored check blob.
 *   - Derived a new key from the new master password.
 *   - Re-encrypted every existing item under the new key.
 *
 * The server just verifies the account password (belt-and-suspenders against a
 * stolen unlocked session), then in a single transaction: swaps the KDF
 * descriptor, replaces every item's ciphertext, and drops version history
 * (history rows are still encrypted with the OLD key and would decrypt to
 * garbage after this — safer to wipe than to keep dead blobs around).
 *
 * The set of item ids in the payload MUST match the server's set exactly.
 * If another device created an item mid-flight, we reject so the client can
 * retry rather than orphaning that item's ciphertext.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = await rateLimit(request, {
    name: 'vault.master-key.rotate',
    limit: 5,
    windowSeconds: 60 * 60,
    identifier: session.userId,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = rotateMasterKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const { password, descriptor, items } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { accountHash: true, kdfSalt: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.kdfSalt === null) {
    return NextResponse.json(
      { error: 'Master password has not been set yet' },
      { status: 409 },
    );
  }
  const ok = await verifyAccountPassword(password, user.accountHash);
  if (!ok) {
    recordAudit(session.userId, 'master_key.rotate_failed', undefined, { request });
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.vaultItem.findMany({
        where: { userId: session.userId },
        select: { id: true },
      });
      const serverIds = new Set(existing.map((row) => row.id));
      const payloadIds = new Set(items.map((row) => row.id));
      if (serverIds.size !== payloadIds.size) {
        throw new RotationConflict();
      }
      for (const id of serverIds) {
        if (!payloadIds.has(id)) throw new RotationConflict();
      }

      // Replace each item's ciphertext. updateMany can't set per-row values,
      // so we issue one update per item scoped to the caller.
      for (const item of items) {
        await tx.vaultItem.update({
          where: { id: item.id },
          data: { cipher: item.cipher, iv: item.iv },
        });
      }

      // History rows are encrypted with the old key and would be undecryptable
      // after the descriptor swap. Drop them.
      await tx.vaultItemHistory.deleteMany({
        where: { item: { userId: session.userId } },
      });

      await tx.user.update({
        where: { id: session.userId },
        data: {
          kdfSalt: descriptor.kdfSalt,
          kdfName: descriptor.kdfName,
          kdfParams: descriptor.kdfParams,
          verifyBlob: descriptor.verifyBlob,
          verifyIv: descriptor.verifyIv,
        },
      });
    });
  } catch (error) {
    if (error instanceof RotationConflict) {
      return NextResponse.json(
        {
          error:
            'Your vault changed on another device. Reload and try again.',
        },
        { status: 409 },
      );
    }
    throw error;
  }

  recordAudit(
    session.userId,
    'master_key.rotated',
    { itemCount: items.length },
    { request },
  );
  return NextResponse.json({ ok: true });
}

class RotationConflict extends Error {
  constructor() {
    super('Vault item set changed during rotation');
    this.name = 'RotationConflict';
  }
}
