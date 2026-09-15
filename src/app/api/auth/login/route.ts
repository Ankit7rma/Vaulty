import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { loginSchema } from '@/lib/auth/schemas';
import { hashAccountPassword, verifyAccountPassword } from '@/lib/auth/password';
import { startSession } from '@/lib/auth/cookies';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';
import { ipFromRequest, isIpAllowed } from '@/lib/auth/ip-allowlist';
import { recordAudit } from '@/lib/auth/audit';

// Decoy hash computed once, used to keep login timing roughly constant whether
// or not the email exists, so response time does not reveal registered emails.
let decoyHash: Promise<string> | null = null;
function getDecoyHash(): Promise<string> {
  if (!decoyHash) decoyHash = hashAccountPassword('vaulty-decoy-never-matches');
  return decoyHash;
}

export async function POST(request: Request) {
  const log = logger.forRequest(request);

  // First gate: per-IP cap so a single source can't brute-force the endpoint.
  const ipLimit = await rateLimit(request, {
    name: 'auth.login.ip',
    limit: 20,
    windowSeconds: 15 * 60,
  });
  if (!ipLimit.ok) {
    log.warn('login.rate_limited_ip', { resetSeconds: ipLimit.resetSeconds });
    return NextResponse.json(
      { error: 'Too many attempts. Try again in a few minutes.' },
      { status: 429, headers: { 'Retry-After': String(ipLimit.resetSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    log.warn('login.bad_json');
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    log.warn('login.invalid_payload');
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
  }
  const { email, password } = parsed.data;

  // Second gate: per-email cap so one victim isn't drained even if the
  // attacker rotates IPs.
  const emailLimit = await rateLimit(request, {
    name: 'auth.login.email',
    limit: 10,
    windowSeconds: 15 * 60,
    identifier: email,
  });
  if (!emailLimit.ok) {
    log.warn('login.rate_limited_email', { resetSeconds: emailLimit.resetSeconds });
    return NextResponse.json(
      { error: 'Too many attempts for this account.' },
      { status: 429, headers: { 'Retry-After': String(emailLimit.resetSeconds) } },
    );
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Always run a verify (against the decoy when the user is missing) so both
    // paths take comparable time and timing does not reveal registered emails.
    let passwordOk = false;
    if (user) {
      passwordOk = await verifyAccountPassword(password, user.accountHash);
    } else {
      await verifyAccountPassword(password, await getDecoyHash());
    }

    if (!user || !passwordOk) {
      log.info('login.rejected', { reason: user ? 'bad_password' : 'no_user' });
      if (user) {
        recordAudit(user.id, 'login.failed', { reason: 'bad_password' }, { request });
      }
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // IP allowlist check (opt-in per user). Runs after credential verification
    // so a rejected IP still doesn't leak whether the password was correct.
    if (user.ipAllowlist.length > 0) {
      const ip = ipFromRequest(request);
      if (!isIpAllowed(ip, user.ipAllowlist)) {
        log.warn('login.ip_blocked', { userId: user.id });
        recordAudit(user.id, 'login.ip_blocked', undefined, { request });
        return NextResponse.json(
          {
            error:
              'Sign-in from this network is blocked by your IP allowlist.',
          },
          { status: 403 },
        );
      }
    }

    await startSession({ userId: user.id, email: user.email });
    log.info('login.success', { userId: user.id });
    recordAudit(user.id, 'login.success', undefined, { request });

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      onboarded: user.kdfSalt !== null,
    });
  } catch (error) {
    log.error('login.error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
