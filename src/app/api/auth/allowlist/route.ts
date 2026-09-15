import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { ipFromRequest, normalizeAllowlist } from '@/lib/auth/ip-allowlist';
import { logger } from '@/lib/logger';
import { recordAudit } from '@/lib/auth/audit';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { ipAllowlist: true },
  });
  return NextResponse.json({
    entries: user?.ipAllowlist ?? [],
    // The current source IP is handy so the user can add it in one click.
    currentIp: ipFromRequest(request),
  });
}

const bodySchema = z.object({
  entries: z.array(z.string().min(1).max(64)).max(32),
});

export async function PUT(request: Request) {
  const log = logger.forRequest(request);
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid entries' }, { status: 400 });
  }
  const normalized = normalizeAllowlist(parsed.data.entries);
  await prisma.user.update({
    where: { id: session.userId },
    data: { ipAllowlist: normalized },
  });
  log.info('allowlist.updated', {
    userId: session.userId,
    count: normalized.length,
  });
  recordAudit(
    session.userId,
    'allowlist.updated',
    { count: normalized.length },
    { request },
  );
  return NextResponse.json({ entries: normalized });
}
