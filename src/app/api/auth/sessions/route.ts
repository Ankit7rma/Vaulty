import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/cookies';
import {
  deleteOtherSessions,
  listSessions,
} from '@/lib/auth/session-store';
import { recordAudit } from '@/lib/auth/audit';

/** Lists live sessions for the current user (never returns the JWT). */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sessions = await listSessions(session.userId);
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      current: s.jti === session.jti,
      userAgent: s.userAgent,
      ipHash: s.ipHash,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
    })),
  });
}

/** Signs out every device except the caller's current one. */
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const removed = await deleteOtherSessions(session.userId, session.jti);
  recordAudit(
    session.userId,
    'session.signout_others',
    { removed },
    { request },
  );
  return NextResponse.json({ removed });
}
