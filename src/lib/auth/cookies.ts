import { cookies, headers } from 'next/headers';
import { env } from '@/lib/env';
import {
  createSessionToken,
  verifySessionToken,
  getSessionTtlHours,
  type SessionPayload,
} from './session';
import {
  createSession,
  deleteSession,
  findLiveSession,
  type SessionMeta,
} from './session-store';

/**
 * Cookie plumbing for the session token. In production the cookie uses the
 * `__Host-` prefix (which requires Secure, path=/, no Domain, and HTTPS) plus
 * SameSite=Strict, so it is never sent on cross-site requests and cannot be
 * overwritten by a subdomain. In development we use the plain name so cookies
 * work over plain-http localhost.
 *
 * Beyond the JWT signature, every request now also has to match a live
 * server-side Session row — deleting the row (sign out, sign out other
 * devices, session cleanup cron) invalidates the token immediately.
 */

const isProd = env.NODE_ENV === 'production';

export const SESSION_COOKIE = isProd ? '__Host-vaulty_session' : 'vaulty_session';

interface StartSessionInput {
  userId: string;
  email: string;
}

async function readMeta(): Promise<SessionMeta> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  return {
    userAgent: h.get('user-agent'),
    ip: forwarded ? forwarded.split(',')[0].trim() : h.get('x-real-ip'),
  };
}

export async function startSession(input: StartSessionInput): Promise<void> {
  const meta = await readMeta();
  const session = await createSession(input.userId, meta);
  const token = await createSessionToken({
    userId: input.userId,
    email: input.email,
    jti: session.jti,
  });
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
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const decoded = await verifySessionToken(token);
    if (decoded) await deleteSession(decoded.jti);
  }
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const decoded = await verifySessionToken(token);
  if (!decoded) return null;
  const row = await findLiveSession(decoded.jti);
  if (!row) return null;
  return decoded;
}
