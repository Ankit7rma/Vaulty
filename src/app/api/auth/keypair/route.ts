import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { recordAudit } from '@/lib/auth/audit';

/**
 * Per-user asymmetric keypair (RSA-OAEP-4096) used to wrap shared-vault keys.
 * The public key is safe to expose; the private key is stored only as
 * ciphertext under the caller's master key, so the server never sees it.
 *
 * GET  - return the current keypair fields (all null if never enrolled).
 * POST - enroll for the first time. Refuses to overwrite an existing keypair
 *        because that would orphan every shared vault key already wrapped for
 *        this user; rotation is a separate flow.
 */

const b64 = z.string().min(1).max(20_000);

const enrollSchema = z.object({
  publicKey: b64,
  wrappedPrivateKey: b64,
  wrappedPrivateKeyIv: b64,
  keypairAlg: z.enum(['rsa-oaep-4096']),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      publicKey: true,
      wrappedPrivateKey: true,
      wrappedPrivateKeyIv: true,
      keypairAlg: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(user);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = enrollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid keypair' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { publicKey: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (existing.publicKey !== null) {
    return NextResponse.json(
      { error: 'Keypair already exists' },
      { status: 409 },
    );
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: parsed.data,
  });
  recordAudit(session.userId, 'keypair.enrolled', { alg: parsed.data.keypairAlg }, {
    request,
  });
  return NextResponse.json({ ok: true });
}
