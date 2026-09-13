import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { loginSchema } from '@/lib/auth/schemas';
import { hashAccountPassword, verifyAccountPassword } from '@/lib/auth/password';
import { startSession } from '@/lib/auth/cookies';
import { logger } from '@/lib/logger';

// Decoy hash computed once, used to keep login timing roughly constant whether
// or not the email exists, so response time does not reveal registered emails.
let decoyHash: Promise<string> | null = null;
function getDecoyHash(): Promise<string> {
  if (!decoyHash) decoyHash = hashAccountPassword('vaulty-decoy-never-matches');
  return decoyHash;
}

export async function POST(request: Request) {
  const log = logger.forRequest(request);
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
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await startSession({ userId: user.id, email: user.email });
    log.info('login.success', { userId: user.id });

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
