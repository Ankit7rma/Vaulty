import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Nightly job that purges expired one-time-share rows. Wired to Vercel Cron
 * via vercel.json. Vercel injects Authorization: Bearer $CRON_SECRET on
 * every cron invocation; unauthenticated requests are rejected.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const log = logger.forRequest(request);
  const authz = request.headers.get('authorization');
  const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;

  // In production a missing CRON_SECRET means the endpoint is closed — better
  // to fail loudly than to accept unauthenticated traffic. In dev we allow
  // manual invocation so the job can be exercised without setting the var.
  if (env.NODE_ENV === 'production') {
    if (!expected || authz !== expected) {
      log.warn('cron.unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (expected && authz !== expected) {
    log.warn('cron.unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const [shares, sessions, invites] = await Promise.all([
      prisma.share.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.sharedVaultInvite.deleteMany({ where: { expiresAt: { lt: now } } }),
    ]);
    log.info('cron.cleanup.success', {
      deletedShares: shares.count,
      deletedSessions: sessions.count,
      deletedInvites: invites.count,
    });
    return NextResponse.json({
      deletedShares: shares.count,
      deletedSessions: sessions.count,
      deletedInvites: invites.count,
    });
  } catch (error) {
    log.error('cron.cleanup.error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
