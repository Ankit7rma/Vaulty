import { NextResponse } from 'next/server';
import { refreshSession } from '@/lib/auth/cookies';

/**
 * Exchange a valid refresh cookie for a fresh access cookie. Middleware
 * normally handles this transparently; this route is the fallback path a
 * client can hit directly (e.g. after a 401 from an SSR data fetch that
 * middleware couldn't cover).
 *
 * Idempotent and rate-limit-insensitive: the refresh cookie is server-
 * verified and tied to a live Session row, so blasting the endpoint gains
 * nothing an attacker didn't already have.
 */
export async function POST() {
  const session = await refreshSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    user: { id: session.userId, email: session.email },
  });
}
