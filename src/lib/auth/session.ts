import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/lib/env';

/**
 * Stateless-signed session tokens (JWT, HS256). Split into two flavors that
 * share the same `jti` (the Session row id):
 *
 *   access  — short TTL (minutes). Sent on every request; if it leaks, the
 *             exposure window is bounded by ACCESS_TTL_MINUTES.
 *   refresh — long TTL (SESSION_TTL_HOURS). Used only to mint fresh access
 *             tokens through /api/auth/refresh; middleware handles the
 *             hand-off transparently so callers only ever see the access
 *             token in getSession().
 *
 * Deleting the Session row (sign out, sign out other devices, server-side
 * expiry cron) instantly kills both flavors because every request also
 * checks the row exists via findLiveSession().
 *
 * This module is intentionally free of next/headers so it stays unit-testable
 * in plain Node.
 */

const ALG = 'HS256';

export type TokenKind = 'access' | 'refresh';

export interface SessionPayload {
  userId: string;
  email: string;
  /** Session row id / JWT ID. */
  jti: string;
  /** Which flavor this token is. */
  kind: TokenKind;
}

function getSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export function getSessionTtlHours(): number {
  return env.SESSION_TTL_HOURS;
}

export function getAccessTtlMinutes(): number {
  return env.ACCESS_TTL_MINUTES;
}

interface CreateTokenInput {
  userId: string;
  email: string;
  jti: string;
}

async function signToken(input: CreateTokenInput, kind: TokenKind): Promise<string> {
  const exp = kind === 'access' ? `${getAccessTtlMinutes()}m` : `${getSessionTtlHours()}h`;
  return new SignJWT({ email: input.email, kind })
    .setProtectedHeader({ alg: ALG })
    .setSubject(input.userId)
    .setJti(input.jti)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(getSecret());
}

export async function createAccessToken(input: CreateTokenInput): Promise<string> {
  return signToken(input, 'access');
}

export async function createRefreshToken(input: CreateTokenInput): Promise<string> {
  return signToken(input, 'refresh');
}

async function verifyToken(
  token: string,
  expected: TokenKind,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    const { sub, email, jti, kind } = payload;
    if (
      typeof sub !== 'string' ||
      typeof email !== 'string' ||
      typeof jti !== 'string' ||
      (kind !== 'access' && kind !== 'refresh')
    ) {
      return null;
    }
    if (kind !== expected) {
      // Refuse to accept an access token where a refresh was expected and
      // vice versa. Prevents a stolen access token from being replayed as a
      // refresh, and vice versa.
      return null;
    }
    return { userId: sub, email, jti, kind };
  } catch {
    // Expired, tampered, or wrong-secret tokens all resolve to "no session".
    return null;
  }
}

export async function verifyAccessToken(
  token: string,
): Promise<SessionPayload | null> {
  return verifyToken(token, 'access');
}

export async function verifyRefreshToken(
  token: string,
): Promise<SessionPayload | null> {
  return verifyToken(token, 'refresh');
}

/**
 * Legacy alias for verifyAccessToken. Kept as a thin wrapper so any
 * imports that still reference `verifySessionToken` (e.g. tests) keep
 * working; new code should use verifyAccessToken directly.
 */
export const verifySessionToken = verifyAccessToken;

/** Legacy alias for createAccessToken. See verifySessionToken above. */
export const createSessionToken = createAccessToken;
