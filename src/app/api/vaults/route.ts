import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { createSharedVaultSchema } from '@/lib/vault/schemas';
import { recordAudit } from '@/lib/auth/audit';

/**
 * Shared-vault collection endpoint.
 *
 * GET  - list vaults the caller can access. Each entry includes the caller's
 *        wrappedKey so the client can unwrap it locally with its private key.
 *        The vault name is returned as ciphertext + iv; only members can
 *        decrypt it because only members hold the vault key.
 * POST - create a new shared vault. The creator sends a client-side-encrypted
 *        name plus the vault key already wrapped with their own public key.
 *        The server writes both the vault row and the owner's membership in
 *        one transaction so no vault ever exists without an owner.
 */

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const memberships = await prisma.sharedVaultMembership.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    select: {
      role: true,
      wrappedKey: true,
      sharedVault: {
        select: {
          id: true,
          name: true,
          nameIv: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    vaults: memberships.map((m) => ({
      id: m.sharedVault.id,
      name: m.sharedVault.name,
      nameIv: m.sharedVault.nameIv,
      ownerId: m.sharedVault.ownerId,
      role: m.role,
      wrappedKey: m.wrappedKey,
      createdAt: m.sharedVault.createdAt,
      updatedAt: m.sharedVault.updatedAt,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { publicKey: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!user.publicKey) {
    // A creator with no keypair could not later unwrap their own vault key,
    // so refuse rather than leave them locked out.
    return NextResponse.json(
      { error: 'Enroll a keypair before creating a shared vault.' },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = createSharedVaultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid vault' }, { status: 400 });
  }
  const { name, nameIv, wrappedKey } = parsed.data;

  const vault = await prisma.$transaction(async (tx) => {
    const created = await tx.sharedVault.create({
      data: {
        ownerId: session.userId,
        name,
        nameIv,
      },
      select: { id: true, name: true, nameIv: true, createdAt: true, updatedAt: true },
    });
    await tx.sharedVaultMembership.create({
      data: {
        sharedVaultId: created.id,
        userId: session.userId,
        role: 'owner',
        wrappedKey,
      },
    });
    return created;
  });

  recordAudit(
    session.userId,
    'shared_vault.created',
    { vaultId: vault.id },
    { request },
  );

  return NextResponse.json(
    {
      vault: {
        id: vault.id,
        name: vault.name,
        nameIv: vault.nameIv,
        ownerId: session.userId,
        role: 'owner',
        wrappedKey,
        createdAt: vault.createdAt,
        updatedAt: vault.updatedAt,
      },
    },
    { status: 201 },
  );
}
