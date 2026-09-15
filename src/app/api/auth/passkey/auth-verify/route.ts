import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/types';
import { prisma } from '@/lib/db';
import { startSession } from '@/lib/auth/cookies';
import { bytesFromDb, getRpConfig } from '@/lib/auth/passkeys';
import { readAndClearChallengeCookie } from '@/lib/auth/passkey-challenge';
import { recordAudit } from '@/lib/auth/audit';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const log = logger.forRequest(request);

  const limit = await rateLimit(request, {
    name: 'auth.passkey',
    limit: 20,
    windowSeconds: 15 * 60,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetSeconds) } },
    );
  }

  const stashed = await readAndClearChallengeCookie();
  if (!stashed) {
    return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });
  }

  let body: { response: AuthenticationResponseJSON };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const response = body?.response;
  if (!response || typeof response.id !== 'string') {
    return NextResponse.json({ error: 'Missing response' }, { status: 400 });
  }

  const credential = await prisma.passkeyCredential.findUnique({
    where: { credentialId: response.id },
    include: {
      user: { select: { id: true, email: true, kdfSalt: true } },
    },
  });
  if (!credential) {
    return NextResponse.json({ error: 'Unknown credential' }, { status: 404 });
  }

  const { rpID, origin } = getRpConfig();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stashed.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.credentialId,
        publicKey: bytesFromDb(credential.publicKey),
        counter: Number(credential.counter),
        transports: credential.transports as never,
      },
      requireUserVerification: false,
    });
  } catch {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }
  if (!verification.verified) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  const nextCounter = BigInt(verification.authenticationInfo.newCounter ?? 0);
  await prisma.passkeyCredential.update({
    where: { id: credential.id },
    data: {
      counter: nextCounter,
      lastUsedAt: new Date(),
    },
  });

  await startSession({
    userId: credential.user.id,
    email: credential.user.email,
  });
  recordAudit(
    credential.user.id,
    'login.success',
    { second_factor: 'passkey' },
    { request },
  );
  log.info('login.success', { userId: credential.user.id, mfa: 'passkey' });
  return NextResponse.json({
    user: { id: credential.user.id, email: credential.user.email },
    onboarded: credential.user.kdfSalt !== null,
  });
}
