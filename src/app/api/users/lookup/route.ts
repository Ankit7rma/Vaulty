import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Look up another user's public key by email so the caller can wrap a shared
 * vault key against it. Requires an authenticated session (this endpoint
 * would otherwise let anyone enumerate accounts + their public keys).
 *
 * Rate-limited per-caller and per-searched-email to blunt bulk enumeration.
 * We do NOT distinguish "no such user" from "user has no keypair" in the
 * response body: both return 404 with the same shape, so the caller only
 * learns "you cannot invite this address yet."
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const emailParam = url.searchParams.get('email');
  if (!emailParam) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }
  const email = emailParam.trim().toLowerCase();
  if (email.length === 0 || email.length > 320 || !email.includes('@')) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 });
  }

  const limit = await rateLimit(request, {
    name: 'users.lookup',
    limit: 60,
    windowSeconds: 60 * 60,
    identifier: session.userId,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many lookups. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetSeconds) } },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, publicKey: true, keypairAlg: true },
  });
  if (!user || !user.publicKey) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({
    id: user.id,
    email: user.email,
    publicKey: user.publicKey,
    keypairAlg: user.keypairAlg,
  });
}
