import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

/**
 * Short-lived cookie that pins the WebAuthn challenge between the options
 * request and the verify request. Signed with JWT_SECRET so a client cannot
 * substitute a challenge they picked themselves.
 */

const ALG = 'HS256';
const TTL_SECONDS = 5 * 60;
const isProd = env.NODE_ENV === 'production';
const COOKIE = isProd ? '__Host-vaulty_webauthn' : 'vaulty_webauthn';

function getSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

interface ChallengePayload {
  challenge: string;
  /** Optional user id: bound during registration; absent for anonymous auth. */
  userId?: string;
}

export async function setChallengeCookie(
  payload: ChallengePayload,
): Promise<void> {
  const token = await new SignJWT({ ...payload, purpose: 'webauthn' })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecret());
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

export async function readAndClearChallengeCookie(): Promise<ChallengePayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  store.delete(COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    if (payload.purpose !== 'webauthn') return null;
    if (typeof payload.challenge !== 'string') return null;
    const userId =
      typeof payload.userId === 'string' ? payload.userId : undefined;
    return { challenge: payload.challenge, userId };
  } catch {
    return null;
  }
}
