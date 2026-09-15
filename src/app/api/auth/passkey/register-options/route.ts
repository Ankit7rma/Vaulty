import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { getRpConfig, RP_NAME } from '@/lib/auth/passkeys';
import { setChallengeCookie } from '@/lib/auth/passkey-challenge';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { rpID } = getRpConfig();
  const existing = await prisma.passkeyCredential.findMany({
    where: { userId: session.userId },
    select: { credentialId: true, transports: true },
  });
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new TextEncoder().encode(session.userId),
    userName: session.email,
    userDisplayName: session.email,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports as never,
    })),
  });
  await setChallengeCookie({
    challenge: options.challenge,
    userId: session.userId,
  });
  return NextResponse.json(options);
}
