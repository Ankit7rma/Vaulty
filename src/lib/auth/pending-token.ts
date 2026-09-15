import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/lib/env';

/**
 * Short-lived JWT that stands in for "password verified, TOTP still needed".
 * Signed with the same JWT_SECRET as session tokens but carries a distinct
 * `purpose` claim so it can never be mistaken for a full session cookie.
 */

const ALG = 'HS256';
const TTL_SECONDS = 5 * 60;
const PURPOSE = 'totp-pending';

function getSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function createPendingTotpToken(userId: string): Promise<string> {
  return new SignJWT({ purpose: PURPOSE })
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyPendingTotpToken(
  token: string,
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    if (payload.purpose !== PURPOSE) return null;
    if (typeof payload.sub !== 'string') return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}
