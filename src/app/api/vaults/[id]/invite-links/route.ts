import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import {
  canManage,
  getSharedVaultRole,
} from '@/lib/auth/shared-vault-access';
import { createInviteLinkSchema } from '@/lib/vault/schemas';
import { recordAudit } from '@/lib/auth/audit';

type Params = { params: Promise<{ id: string }> };

const DEFAULT_LINK_TTL_HOURS = 7 * 24;
const TOKEN_BYTES = 24;

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  // URL-safe base64 without padding.
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Signed invite links: owner-only CRUD.
 *
 * GET  - list active links for the vault (token + role + expiry + counts).
 * POST - mint a new link. Server generates the token; client picks role +
 *        expiry + max uses. Recipients follow the token URL, sign in (or
 *        sign up), and their public key is registered on claim; the owner
 *        then completes the wrap through /pending-wraps/[wrapId]/complete.
 *
 * Unlike email invites, no wrappedKey is generated here — the invitee's
 * public key may not exist yet at link-creation time. That's the whole
 * point: this flow works even if the recipient has never used Vaulty.
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
  const links = await prisma.sharedVaultInviteLink.findMany({
    where: { sharedVaultId: id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      token: true,
      role: true,
      createdAt: true,
      expiresAt: true,
      maxUses: true,
      useCount: true,
      invitedBy: true,
    },
  });
  return NextResponse.json({ links });
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
    body = {};
  }
  const parsed = createInviteLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
  }

  const expiresAt = new Date(
    Date.now() +
      (parsed.data.expiresInHours ?? DEFAULT_LINK_TTL_HOURS) * 60 * 60 * 1000,
  );
  const link = await prisma.sharedVaultInviteLink.create({
    data: {
      sharedVaultId: id,
      token: generateToken(),
      role: parsed.data.role,
      invitedBy: session.userId,
      expiresAt,
      maxUses: parsed.data.maxUses ?? 1,
    },
    select: {
      id: true,
      token: true,
      role: true,
      createdAt: true,
      expiresAt: true,
      maxUses: true,
      useCount: true,
    },
  });
  recordAudit(
    session.userId,
    'shared_vault.invite_link_created',
    { vaultId: id, linkId: link.id, role: link.role, maxUses: link.maxUses },
    { request },
  );
  return NextResponse.json({ link }, { status: 201 });
}
