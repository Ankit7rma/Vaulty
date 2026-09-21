import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { createInviteSchema } from '@/lib/vault/schemas';
import {
  canManage,
  getSharedVaultRole,
} from '@/lib/auth/shared-vault-access';
import { recordAudit } from '@/lib/auth/audit';

type Params = { params: Promise<{ id: string }> };

const DEFAULT_INVITE_TTL_HOURS = 7 * 24;

/**
 * Invites for a shared vault. Only the owner can manage them.
 *
 * GET  - list outstanding invites (email, role, expiresAt). Never returns the
 *        wrappedKey — that is only useful to the recipient and would let a
 *        stolen owner session leak wrapped keys otherwise safely at rest.
 * POST - create an invite. The inviter has already looked up the recipient's
 *        public key and wrapped the vault key against it. Uniqueness on
 *        (vaultId, email) prevents double-invites for the same address.
 */
export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const role = await getSharedVaultRole(session.userId, id);
  if (!role || !canManage(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const invites = await prisma.sharedVaultInvite.findMany({
    where: { sharedVaultId: id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      expiresAt: true,
      invitedBy: true,
    },
  });
  return NextResponse.json({ invites });
}

export async function POST(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
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
  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid invite' }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();

  // Refuse to invite an address that is already a member. Note we can't check
  // whether the invited address is registered — that would leak account
  // existence to the caller. Membership check is scoped to this vault only.
  const existingMember = await prisma.sharedVaultMembership.findFirst({
    where: { sharedVaultId: id, user: { email } },
    select: { id: true },
  });
  if (existingMember) {
    return NextResponse.json(
      { error: 'That user is already a member.' },
      { status: 409 },
    );
  }

  const expiresAt = new Date(
    Date.now() +
      (parsed.data.expiresInHours ?? DEFAULT_INVITE_TTL_HOURS) * 60 * 60 * 1000,
  );

  try {
    const invite = await prisma.sharedVaultInvite.create({
      data: {
        sharedVaultId: id,
        email,
        role: parsed.data.role,
        wrappedKey: parsed.data.wrappedKey,
        invitedBy: session.userId,
        expiresAt,
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    recordAudit(
      session.userId,
      'shared_vault.invite_sent',
      { vaultId: id, role: parsed.data.role },
      { request },
    );
    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    // Prisma P2002 = unique constraint violation on (sharedVaultId, email).
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'That address already has an invite.' },
        { status: 409 },
      );
    }
    throw error;
  }
}
