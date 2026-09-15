import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { startSession } from '@/lib/auth/cookies';
import { verifyPendingTotpToken } from '@/lib/auth/pending-token';
import { verifyTotpCode } from '@/lib/auth/totp';
import { recordAudit } from '@/lib/auth/audit';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';

const bodySchema = z.object({
  pending: z.string().min(1),
  code: z.string().min(6).max(8),
});

/**
 * Second step of the TOTP-gated login flow. Consumes the short-lived pending
 * token from /api/auth/login and finalizes the session on a valid 6-digit
 * code.
 */
export async function POST(request: Request) {
  const log = logger.forRequest(request);

  // Rate-limit brute-force of the code.
  const limit = await rateLimit(request, {
    name: 'auth.login.totp',
    limit: 10,
    windowSeconds: 15 * 60,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in a few minutes.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetSeconds) } },
    );
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
  const decoded = await verifyPendingTotpToken(parsed.data.pending);
  if (!decoded) {
    return NextResponse.json(
      { error: 'Sign-in expired. Please try again.' },
      { status: 401 },
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      email: true,
      totpSecret: true,
      totpEnabled: true,
      kdfSalt: true,
    },
  });
  if (!user || !user.totpEnabled || !user.totpSecret) {
    return NextResponse.json(
      { error: 'Two-factor authentication is not enabled.' },
      { status: 400 },
    );
  }
  const ok = await verifyTotpCode(user.totpSecret, parsed.data.code);
  if (!ok) {
    recordAudit(user.id, 'login.totp_failed', undefined, { request });
    log.info('login.totp_failed', { userId: user.id });
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 });
  }

  await startSession({ userId: user.id, email: user.email });
  recordAudit(user.id, 'login.success', { second_factor: 'totp' }, { request });
  log.info('login.success', { userId: user.id, mfa: 'totp' });
  return NextResponse.json({
    user: { id: user.id, email: user.email },
    onboarded: user.kdfSalt !== null,
  });
}
