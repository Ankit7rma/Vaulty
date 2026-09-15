import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/cookies';
import { buildOtpauthUri, generateBase32Secret } from '@/lib/auth/totp';

/**
 * Kicks off TOTP enrollment. The secret is returned to the client but NOT
 * persisted; the user must confirm with a valid code (which stores it).
 * Anyone who reads the response therefore still needs a working authenticator
 * to complete enrollment.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const secret = generateBase32Secret();
  const otpauth = buildOtpauthUri('Vaulty', session.email, secret);
  return NextResponse.json({ secret, otpauth });
}
