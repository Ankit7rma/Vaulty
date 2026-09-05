import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { onboardSchema } from '@/lib/vault/schemas';

/**
 * Stores the public KDF descriptor + opaque check blob produced client-side
 * during master-password onboarding. Nothing here can decrypt vault data.
 */
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

  const parsed = onboardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid onboarding payload' }, { status: 400 });
  }
  const { kdfSalt, kdfName, kdfParams, verifyBlob, verifyIv } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { kdfSalt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Refuse to overwrite an existing setup: that would orphan every item the
  // current key encrypted, permanently.
  if (existing.kdfSalt !== null) {
    return NextResponse.json(
      { error: 'Master password is already set' },
      { status: 409 },
    );
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { kdfSalt, kdfName, kdfParams, verifyBlob, verifyIv },
  });

  return NextResponse.json({ ok: true });
}
