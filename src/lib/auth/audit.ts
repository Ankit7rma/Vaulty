import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Per-user audit trail. Fire-and-forget: audit writes never block or fail a
 * request, since a broken audit table shouldn't take the app down. All writes
 * also mirror to the structured logger for infra-level visibility.
 *
 * IPs are hashed (see hashIp) so a raw address never lands in Postgres.
 */

const IP_HASH_PREFIX_BYTES = 8;
const MAX_META_JSON_BYTES = 4_000;

async function hashIp(ip: string | null | undefined): Promise<string | null> {
  if (!ip) return null;
  const bytes = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  let hex = '';
  for (const byte of new Uint8Array(digest).slice(0, IP_HASH_PREFIX_BYTES)) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

export interface AuditContext {
  request?: Request;
  ip?: string | null;
  userAgent?: string | null;
}

function extract(context: AuditContext | undefined) {
  if (context?.request) {
    const req = context.request;
    const forwarded = req.headers.get('x-forwarded-for');
    return {
      userAgent: req.headers.get('user-agent'),
      ip: forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip'),
    };
  }
  return {
    userAgent: context?.userAgent ?? null,
    ip: context?.ip ?? null,
  };
}

function trimMeta(meta: unknown): unknown {
  if (meta === undefined) return null;
  try {
    const encoded = JSON.stringify(meta);
    if (encoded.length > MAX_META_JSON_BYTES) {
      return { truncated: true, byteLength: encoded.length };
    }
    return meta;
  } catch {
    return { truncated: true, reason: 'unserializable' };
  }
}

export function recordAudit(
  userId: string,
  event: string,
  meta?: unknown,
  context?: AuditContext,
): void {
  const { userAgent, ip } = extract(context);
  const cleanedMeta = trimMeta(meta);

  // Best-effort DB write. Never block the caller; log at info if writing fails.
  (async () => {
    try {
      const ipHash = await hashIp(ip);
      await prisma.auditEvent.create({
        data: {
          userId,
          event,
          meta: cleanedMeta === null ? undefined : (cleanedMeta as never),
          ipHash,
          userAgent,
        },
      });
    } catch (error) {
      logger.warn('audit.write_failed', {
        event,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  // Always mirror to the structured logger for observability.
  logger.info(`audit.${event}`, { userId, meta: cleanedMeta });
}
