import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Dev-only endpoint that walks every user-content-carrying column in the
 * database and looks for a caller-supplied plaintext marker. The intent is
 * to give the E2E "plaintext-never-in-DB" smoke test a single call it can
 * use to prove nothing leaked through any code path.
 *
 * NOT AVAILABLE IN PRODUCTION: any call in prod returns 404 with an empty
 * body so it's indistinguishable from a missing route. This route also
 * NEVER accepts a marker via body — it's a query string so it's obvious in
 * logs when it fires.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }
  const url = new URL(request.url);
  const marker = url.searchParams.get('marker');
  if (!marker || marker.length < 8 || marker.length > 256) {
    return NextResponse.json(
      { error: 'marker must be 8-256 chars' },
      { status: 400 },
    );
  }

  // Types are deliberately loose here: we just need "does this string
  // appear anywhere". A single lower-cased pass over each value suffices;
  // the ZK invariant is binary (present or absent), not statistical.
  const needle = marker;
  const hits: Array<{
    table: string;
    column: string;
    rowId: string;
    sample: string;
  }> = [];

  function record(
    table: string,
    column: string,
    rowId: string,
    value: unknown,
  ): void {
    if (value === null || value === undefined) return;
    const asString =
      typeof value === 'string' ? value : JSON.stringify(value);
    if (asString.includes(needle)) {
      hits.push({
        table,
        column,
        rowId,
        sample: asString.slice(0, 200),
      });
    }
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      accountHash: true,
      kdfSalt: true,
      kdfName: true,
      kdfParams: true,
      verifyBlob: true,
      verifyIv: true,
      settings: true,
      publicKey: true,
      wrappedPrivateKey: true,
      wrappedPrivateKeyIv: true,
      keypairAlg: true,
      totpSecret: true,
    },
  });
  for (const u of users) {
    for (const [col, val] of Object.entries(u)) {
      if (col === 'id') continue;
      record('User', col, u.id, val);
    }
  }

  const items = await prisma.vaultItem.findMany({
    select: {
      id: true,
      type: true,
      cipher: true,
      iv: true,
      sharedVaultId: true,
    },
  });
  for (const i of items) {
    record('VaultItem', 'type', i.id, i.type);
    record('VaultItem', 'cipher', i.id, i.cipher);
    record('VaultItem', 'iv', i.id, i.iv);
  }

  const history = await prisma.vaultItemHistory.findMany({
    select: { id: true, type: true, cipher: true, iv: true },
  });
  for (const h of history) {
    record('VaultItemHistory', 'type', h.id, h.type);
    record('VaultItemHistory', 'cipher', h.id, h.cipher);
    record('VaultItemHistory', 'iv', h.id, h.iv);
  }

  const shares = await prisma.share.findMany({
    select: { id: true, token: true, cipher: true, iv: true, passSalt: true },
  });
  for (const s of shares) {
    record('Share', 'token', s.id, s.token);
    record('Share', 'cipher', s.id, s.cipher);
    record('Share', 'iv', s.id, s.iv);
    record('Share', 'passSalt', s.id, s.passSalt);
  }

  const vaults = await prisma.sharedVault.findMany({
    select: { id: true, name: true, nameIv: true },
  });
  for (const v of vaults) {
    record('SharedVault', 'name', v.id, v.name);
    record('SharedVault', 'nameIv', v.id, v.nameIv);
  }

  const memberships = await prisma.sharedVaultMembership.findMany({
    select: { id: true, wrappedKey: true },
  });
  for (const m of memberships) {
    record('SharedVaultMembership', 'wrappedKey', m.id, m.wrappedKey);
  }

  const invites = await prisma.sharedVaultInvite.findMany({
    select: { id: true, email: true, wrappedKey: true },
  });
  for (const i of invites) {
    // Email is a legitimate plaintext column (used to match on accept), so we
    // still scan it — if the marker leaks through there via a bug, that's
    // still a finding. The test picks a marker that is obviously not an
    // email address to avoid false positives.
    record('SharedVaultInvite', 'email', i.id, i.email);
    record('SharedVaultInvite', 'wrappedKey', i.id, i.wrappedKey);
  }

  const audits = await prisma.auditEvent.findMany({
    select: { id: true, event: true, meta: true, userAgent: true, ipHash: true },
  });
  for (const a of audits) {
    record('AuditEvent', 'event', a.id, a.event);
    record('AuditEvent', 'meta', a.id, a.meta);
    record('AuditEvent', 'userAgent', a.id, a.userAgent);
    record('AuditEvent', 'ipHash', a.id, a.ipHash);
  }

  const sessions = await prisma.session.findMany({
    select: { id: true, jti: true, userAgent: true, ipHash: true },
  });
  for (const s of sessions) {
    record('Session', 'jti', s.id, s.jti);
    record('Session', 'userAgent', s.id, s.userAgent);
    record('Session', 'ipHash', s.id, s.ipHash);
  }

  return NextResponse.json({
    marker,
    hits,
    scanned: {
      users: users.length,
      items: items.length,
      history: history.length,
      shares: shares.length,
      sharedVaults: vaults.length,
      memberships: memberships.length,
      invites: invites.length,
      audits: audits.length,
      sessions: sessions.length,
    },
  });
}
