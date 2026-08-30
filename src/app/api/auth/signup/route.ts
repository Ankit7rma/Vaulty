import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signupSchema } from '@/lib/auth/schemas';
import { hashAccountPassword } from '@/lib/auth/password';
import { startSession } from '@/lib/auth/cookies';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const accountHash = await hashAccountPassword(password);

  try {
    const user = await prisma.user.create({
      data: { email, accountHash },
      select: { id: true, email: true, kdfSalt: true },
    });

    await startSession({ userId: user.id, email: user.email });

    return NextResponse.json(
      { user: { id: user.id, email: user.email }, onboarded: user.kdfSalt !== null },
      { status: 201 },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'Email is already registered' }, { status: 409 });
    }
    throw error;
  }
}
