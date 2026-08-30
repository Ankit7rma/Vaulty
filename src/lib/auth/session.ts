import { SignJWT, jwtVerify } from 'jose';

/**
 * Stateless session tokens (JWT, HS256) that authorize API calls. The token
 * carries only identity (user id + email); it can never decrypt vault data.
 *
 * This module is intentionally free of next/headers so it stays unit-testable
 * in plain Node. Cookie plumbing lives in ./cookies.
 */

const ALG = 'HS256';
const DEFAULT_TTL_HOURS = 12;

export interface SessionPayload {
  userId: string;
  email: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET must be set and at least 16 characters');
  }
  return new TextEncoder().encode(secret);
}

export function getSessionTtlHours(): number {
  const parsed = Number(process.env.SESSION_TTL_HOURS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_HOURS;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${getSessionTtlHours()}h`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    const { sub, email } = payload;
    if (typeof sub !== 'string' || typeof email !== 'string') return null;
    return { userId: sub, email };
  } catch {
    // Expired, tampered, or wrong-secret tokens all resolve to "no session".
    return null;
  }
}
