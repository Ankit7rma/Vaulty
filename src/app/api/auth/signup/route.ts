import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signupSchema } from '@/lib/auth/schemas';
import { hashAccountPassword } from '@/lib/auth/password';
import { startSession } from '@/lib/auth/cookies';
import { logger } from '@/lib/logger';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

export async function POST(request: Request) {
  const log = logger.forRequest(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    log.warn('signup.bad_json');
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    log.warn('signup.invalid_payload');
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 });
  }
  const { email, password } = parsed.data;

  try {
    const accountHash = await hashAccountPassword(password);
    const user = await prisma.user.create({
      data: { email, accountHash },
      select: { id: true, email: true, kdfSalt: true },
    });

    await startSession({ userId: user.id, email: user.email });
    log.info('signup.success', { userId: user.id });

    return NextResponse.json(
      { user: { id: user.id, email: user.email }, onboarded: user.kdfSalt !== null },
      { status: 201 },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      log.info('signup.duplicate_email');
      return NextResponse.json({ error: 'Email is already registered' }, { status: 409 });
    }
    log.error('signup.error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
