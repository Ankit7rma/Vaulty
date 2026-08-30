import { cookies } from 'next/headers';
import {
  createSessionToken,
  verifySessionToken,
  getSessionTtlHours,
  type SessionPayload,
} from './session';

/**
 * Cookie plumbing for the session token. The JWT is stored in an httpOnly,
 * secure (in production), SameSite=Lax cookie so client JS can never read it
 * and it is not sent on cross-site requests.
 */

export const SESSION_COOKIE = 'vaulty_session';

export async function startSession(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
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
