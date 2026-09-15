import { NextResponse } from 'next/server';
import { endSession, getSession } from '@/lib/auth/cookies';
import { recordAudit } from '@/lib/auth/audit';

export async function POST(request: Request) {
  const session = await getSession();
  await endSession();
  if (session) {
    recordAudit(session.userId, 'session.signout', undefined, { request });
  }
  return NextResponse.json({ ok: true });
}
