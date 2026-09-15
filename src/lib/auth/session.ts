import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/lib/env';

/**
 * Stateless-signed session tokens (JWT, HS256) that authorize API calls. Each
 * token now also carries a `jti` claim that maps to a server-side Session
 * row; the token is only accepted while that row exists and has not expired.
 * That's what makes "sign out" and "sign out other devices" actually kill
 * live tokens even though the JWT signature is still valid.
 *
 * This module is intentionally free of next/headers so it stays unit-testable
 * in plain Node. Cookie plumbing lives in ./cookies; Session-row plumbing in
 * ./session-store.
 */

const ALG = 'HS256';

export interface SessionPayload {
  userId: string;
  email: string;
  /** Session row id / JWT ID. */
  jti: string;
}

function getSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export function getSessionTtlHours(): number {
  return env.SESSION_TTL_HOURS;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.userId)
    .setJti(payload.jti)
    .setIssuedAt()
    .setExpirationTime(`${getSessionTtlHours()}h`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    const { sub, email, jti } = payload;
    if (
      typeof sub !== 'string' ||
      typeof email !== 'string' ||
      typeof jti !== 'string'
    ) {
      return null;
    }
    return { userId: sub, email, jti };
  } catch {
    // Expired, tampered, or wrong-secret tokens all resolve to "no session".
    return null;
  }
}
