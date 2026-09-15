import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { verifyTotpCode } from '@/lib/auth/totp';
import { recordAudit } from '@/lib/auth/audit';

const bodySchema = z.object({
  secret: z.string().min(16).max(64),
  code: z.string().min(6).max(8),
});

/**
 * Confirms enrollment: verifies the supplied code against the client-held
 * secret, then persists the secret and flips totpEnabled to true.
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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const { secret, code } = parsed.data;

  const ok = await verifyTotpCode(secret, code);
  if (!ok) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: session.userId },
    data: { totpSecret: secret, totpEnabled: true },
  });
  recordAudit(session.userId, 'totp.enabled', undefined, { request });
  return NextResponse.json({ ok: true });
}
