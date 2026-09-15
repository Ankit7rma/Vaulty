import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { verifyAccountPassword } from '@/lib/auth/password';
import { recordAudit } from '@/lib/auth/audit';

const bodySchema = z.object({
  password: z.string().min(1).max(200),
});

/**
 * Disables 2FA. Requires the account password (not just a session) so a
 * stolen laptop can't drop the second factor via the vault UI.
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
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { accountHash: true },
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const ok = await verifyAccountPassword(parsed.data.password, user.accountHash);
  if (!ok) {
    recordAudit(session.userId, 'totp.disable_failed', undefined, { request });
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }
  await prisma.user.update({
    where: { id: session.userId },
    data: { totpSecret: null, totpEnabled: false },
  });
  recordAudit(session.userId, 'totp.disabled', undefined, { request });
  return NextResponse.json({ ok: true });
}
