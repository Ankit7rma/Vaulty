import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { loginSchema } from '@/lib/auth/schemas';
import { hashAccountPassword, verifyAccountPassword } from '@/lib/auth/password';
import { startSession } from '@/lib/auth/cookies';

// Decoy hash computed once, used to keep login timing roughly constant whether
// or not the email exists, so response time does not reveal registered emails.
let decoyHash: Promise<string> | null = null;
function getDecoyHash(): Promise<string> {
  if (!decoyHash) decoyHash = hashAccountPassword('vaulty-decoy-never-matches');
  return decoyHash;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
  }
  const { email, password } = parsed.data;

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
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  await startSession({ userId: user.id, email: user.email });

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    onboarded: user.kdfSalt !== null,
  });
}
