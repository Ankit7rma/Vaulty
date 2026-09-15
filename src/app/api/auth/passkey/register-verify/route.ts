import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { bytesForDb, getRpConfig } from '@/lib/auth/passkeys';
import { readAndClearChallengeCookie } from '@/lib/auth/passkey-challenge';
import { recordAudit } from '@/lib/auth/audit';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const stashed = await readAndClearChallengeCookie();
  if (!stashed || stashed.userId !== session.userId) {
    return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });
  }

  let body: { response: RegistrationResponseJSON; label?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body?.response) {
    return NextResponse.json({ error: 'Missing response' }, { status: 400 });
  }

  const { rpID, origin } = getRpConfig();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: stashed.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch {
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 400 },
    );
  }
  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 400 },
    );
  }

  const info = verification.registrationInfo;
  await prisma.passkeyCredential.create({
    data: {
      userId: session.userId,
      credentialId: info.credential.id,
      publicKey: bytesForDb(info.credential.publicKey) as never,
      counter: BigInt(info.credential.counter ?? 0),
      transports: (body.response.response?.transports as string[] | undefined) ?? [],
      label: body.label?.trim() || null,
    },
  });
  recordAudit(session.userId, 'passkey.registered', undefined, { request });
  return NextResponse.json({ ok: true });
}
