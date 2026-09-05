import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { shareInputSchema } from '@/lib/vault/schemas';

const DEFAULT_EXPIRY_HOURS = 24;

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Buffer.from(bytes).toString('base64url');
}

/**
 * Creates a one-time share. The body is opaque ciphertext already encrypted
 * (client-side) with a random key that stays in the share URL fragment, so this
 * endpoint - and the database - never see the key or the plaintext.
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

  const parsed = shareInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid share payload' }, { status: 400 });
  }
  const { cipher, iv, expiresInHours } = parsed.data;

  const token = generateToken();
  const expiresAt = new Date(
    Date.now() + (expiresInHours ?? DEFAULT_EXPIRY_HOURS) * 60 * 60 * 1000,
  );

  await prisma.share.create({ data: { token, cipher, iv, expiresAt } });

  return NextResponse.json({ token }, { status: 201 });
}
