import { cookies, headers } from 'next/headers';
import { env } from '@/lib/env';
import {
  createAccessToken,
  createRefreshToken,
  getAccessTtlMinutes,
  getSessionTtlHours,
  verifyAccessToken,
  verifyRefreshToken,
  type SessionPayload,
} from './session';
import {
  createSession,
  deleteSession,
  findLiveSession,
  type SessionMeta,
} from './session-store';

/**
 * Cookie plumbing for the split access / refresh session tokens. In
 * production both cookies use the `__Host-` prefix (which requires Secure,
 * path=/, no Domain, and HTTPS) plus SameSite=Strict, so they are never
 * sent on cross-site requests and cannot be overwritten by a subdomain. In
 * development we use plain names so cookies work over plain-http localhost.
 *
 * Beyond the JWT signature, every request also has to match a live
 * server-side Session row — deleting the row (sign out, sign out other
 * devices, session cleanup cron) invalidates both tokens immediately.
 *
 * Middleware.ts handles the transparent "access expired but refresh valid"
 * hand-off so route handlers only ever see the access cookie in getSession().
 */

const isProd = env.NODE_ENV === 'production';

export const ACCESS_COOKIE = isProd ? '__Host-vaulty_access' : 'vaulty_access';
export const REFRESH_COOKIE = isProd
  ? '__Host-vaulty_refresh'
  : 'vaulty_refresh';

// Cookie names used by earlier versions. Deleted alongside the new pair on
// sign out so a stale legacy cookie can't linger and confuse things.
const LEGACY_COOKIES = ['vaulty_session', '__Host-vaulty_session'] as const;

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

async function writeAccessCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/',
    maxAge: getAccessTtlMinutes() * 60,
  });
}

async function writeRefreshCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/',
    maxAge: getSessionTtlHours() * 60 * 60,
  });
}

export async function startSession(input: StartSessionInput): Promise<void> {
  const meta = await readMeta();
  const session = await createSession(input.userId, meta);
  const tokenInput = { ...input, jti: session.jti };
  const [access, refresh] = await Promise.all([
    createAccessToken(tokenInput),
    createRefreshToken(tokenInput),
  ]);
  await writeAccessCookie(access);
  await writeRefreshCookie(refresh);
  // Best-effort: drop any legacy single-cookie leftovers so getSession never
  // reads a stale one after an upgrade.
  const store = await cookies();
  for (const name of LEGACY_COOKIES) store.delete(name);
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  let jti: string | null = null;
  if (accessToken) {
    jti = (await verifyAccessToken(accessToken))?.jti ?? null;
  }
  if (!jti && refreshToken) {
    jti = (await verifyRefreshToken(refreshToken))?.jti ?? null;
  }
  if (jti) await deleteSession(jti);
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  for (const name of LEGACY_COOKIES) store.delete(name);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const decoded = await verifyAccessToken(token);
  if (!decoded) return null;
  const row = await findLiveSession(decoded.jti);
  if (!row) return null;
  return decoded;
}

/**
 * Read the refresh cookie, verify it against a live Session row, mint a
 * fresh access token, and set the access cookie. Returns the decoded
 * session on success, or null when the refresh is missing/invalid/expired
 * or its Session row has been revoked.
 *
 * Called by the /api/auth/refresh route AND by middleware.ts. Both places
 * can call cookies().set() legitimately (Route Handler and Middleware
 * contexts, respectively).
 */
export async function refreshSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;
  const decoded = await verifyRefreshToken(refreshToken);
  if (!decoded) return null;
  const row = await findLiveSession(decoded.jti);
  if (!row) return null;

  const access = await createAccessToken({
    userId: decoded.userId,
    email: decoded.email,
    jti: decoded.jti,
  });
  await writeAccessCookie(access);
  return { ...decoded, kind: 'access' };
}
