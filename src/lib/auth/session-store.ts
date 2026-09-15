import { prisma } from '@/lib/db';
import { getSessionTtlHours } from './session';

/**
 * Server-side session records that back the JWT cookie. Any token whose `jti`
 * does not match an unexpired row here is rejected as unauthorized.
 *
 * Raw IP addresses are never stored; we keep a truncated SHA-256 hash so the
 * sessions list can distinguish rough locations without leaking the actual
 * address to a database dumper.
 */

const IP_HASH_PREFIX_BYTES = 8; // 64 bits of the SHA-256 digest

async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const bytes = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  let hex = '';
  for (const byte of new Uint8Array(digest).slice(0, IP_HASH_PREFIX_BYTES)) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

function randomJti(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

export interface SessionMeta {
  userAgent?: string | null;
  ip?: string | null;
}

export interface CreatedSession {
  id: string;
  jti: string;
  expiresAt: Date;
}

export async function createSession(
  userId: string,
  meta: SessionMeta = {},
): Promise<CreatedSession> {
  const jti = randomJti();
  const expiresAt = new Date(
    Date.now() + getSessionTtlHours() * 60 * 60 * 1000,
  );
  const ipHash = await hashIp(meta.ip ?? null);
  const row = await prisma.session.create({
    data: {
      jti,
      userId,
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ipHash,
    },
    select: { id: true, jti: true, expiresAt: true },
  });
  return row;
}

/**
 * Returns the session if it is unexpired. Touches lastUsedAt lazily so the
 * sessions list stays roughly accurate without an update on every request:
 * only refresh once per hour.
 */
export async function findLiveSession(jti: string) {
  const row = await prisma.session.findUnique({
    where: { jti },
    select: {
      id: true,
      userId: true,
      lastUsedAt: true,
      expiresAt: true,
    },
  });
  if (!row) return null;
  if (row.expiresAt < new Date()) {
    // Best-effort delete of the expired row so it doesn't linger.
    prisma.session.delete({ where: { jti } }).catch(() => {});
    return null;
  }
  const ageMs = Date.now() - row.lastUsedAt.getTime();
  if (ageMs > 60 * 60 * 1000) {
    prisma.session
      .update({ where: { jti }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }
  return row;
}

export async function deleteSession(jti: string): Promise<void> {
  await prisma.session.deleteMany({ where: { jti } }).catch(() => {});
}

/** Kills every session for the user except the current jti. */
export async function deleteOtherSessions(
  userId: string,
  keepJti: string,
): Promise<number> {
  const res = await prisma.session.deleteMany({
    where: { userId, NOT: { jti: keepJti } },
  });
  return res.count;
}

export async function listSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId },
    orderBy: { lastUsedAt: 'desc' },
    select: {
      id: true,
      jti: true,
      userAgent: true,
      ipHash: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
  });
}
