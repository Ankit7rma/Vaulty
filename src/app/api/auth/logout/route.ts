import { NextResponse } from 'next/server';
import { endSession } from '@/lib/auth/cookies';

export async function POST() {
  await endSession();
  return NextResponse.json({ ok: true });
}
