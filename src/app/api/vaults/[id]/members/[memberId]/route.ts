import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import {
  canManage,
  getSharedVaultRole,
} from '@/lib/auth/shared-vault-access';
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
