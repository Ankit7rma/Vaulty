import { NextResponse, type NextRequest } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';

/**
 * Access/refresh cookie hand-off.
 *
 * If the request carries a valid refresh cookie but the access cookie is
 * missing or expired, we mint a fresh access JWT here and:
 *   - set it on the outgoing response cookie
 *   - rewrite it onto the incoming request cookie so downstream Route
 *     Handlers reading getSession() see the new value in this same request
 *
 * Middleware runs on the Edge runtime and cannot import Prisma. That's fine
 * for this hand-off: signature verification is stateless, and the DB check
 * (findLiveSession) still runs later inside every Route Handler via
 * getSession(), so a revoked session still 401s even if middleware minted
 * a fresh access cookie against a stale refresh JWT.
 *
 * ACCESS_TTL_MINUTES has to be duplicated here (matching src/lib/env.ts)
 * because middleware can't import the zod-validated env module without
 * pulling in server-only deps. Kept in sync via a code comment.
 */

const ALG = 'HS256';
const ACCESS_TTL_MINUTES = Number(process.env.ACCESS_TTL_MINUTES ?? 15);
const IS_PROD = process.env.NODE_ENV === 'production';

const ACCESS_COOKIE = IS_PROD ? '__Host-vaulty_access' : 'vaulty_access';
const REFRESH_COOKIE = IS_PROD ? '__Host-vaulty_refresh' : 'vaulty_refresh';

interface RefreshPayload {
  sub: string;
  email: string;
  jti: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET missing at runtime');
  return new TextEncoder().encode(secret);
}

async function verifyRefresh(token: string): Promise<RefreshPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    if (
      typeof payload.sub === 'string' &&
      typeof payload.email === 'string' &&
      typeof payload.jti === 'string' &&
      payload.kind === 'refresh'
    ) {
      return { sub: payload.sub, email: payload.email, jti: payload.jti };
    }
    return null;
  } catch {
    return null;
  }
}

async function verifyAccess(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    return payload.kind === 'access';
  } catch {
    return false;
  }
}

async function mintAccess(payload: RefreshPayload): Promise<string> {
  return new SignJWT({ email: payload.email, kind: 'access' })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setJti(payload.jti)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_MINUTES}m`)
    .sign(getSecret());
}

export async function middleware(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  if (access && (await verifyAccess(access))) {
    return NextResponse.next();
  }

  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) return NextResponse.next();
  const payload = await verifyRefresh(refresh);
  if (!payload) return NextResponse.next();

  const newAccess = await mintAccess(payload);

  // Rewrite the incoming request cookie so the downstream Route Handler /
  // Server Component reading getSession() in this same request sees the
  // fresh token, not the missing/expired one.
  const requestHeaders = new Headers(request.headers);
  const existing = requestHeaders.get('cookie') ?? '';
  const filtered = existing
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith(`${ACCESS_COOKIE}=`));
  filtered.push(`${ACCESS_COOKIE}=${newAccess}`);
  requestHeaders.set('cookie', filtered.join('; '));

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set(ACCESS_COOKIE, newAccess, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'strict' : 'lax',
    path: '/',
    maxAge: ACCESS_TTL_MINUTES * 60,
  });
  return response;
}

/**
 * Skip static assets, public marketing pages, and the auth endpoints that
 * mint session cookies themselves. Everything else (protected pages + API
 * routes) benefits from the hand-off.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/auth/login|api/auth/signup|api/auth/refresh).*)',
  ],
};
