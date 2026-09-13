import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import {
  createSessionToken,
  verifySessionToken,
  getSessionTtlHours,
  type SessionPayload,
} from './session';

/**
 * Cookie plumbing for the session token. In production the cookie uses the
 * `__Host-` prefix (which requires Secure, path=/, no Domain, and HTTPS) plus
 * SameSite=Strict, so it is never sent on cross-site requests and cannot be
 * overwritten by a subdomain. In development we use the plain name so cookies
 * work over plain-http localhost.
 *
 * The JWT is always httpOnly so client JS (including any injected script) can
 * never read it.
 */

const isProd = env.NODE_ENV === 'production';

export const SESSION_COOKIE = isProd ? '__Host-vaulty_session' : 'vaulty_session';

export async function startSession(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/',
    maxAge: getSessionTtlHours() * 60 * 60,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
