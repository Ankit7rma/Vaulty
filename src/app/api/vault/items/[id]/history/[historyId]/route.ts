import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';

type Params = { params: Promise<{ id: string; historyId: string }> };

/**
 * Delete a single pinned checkpoint. Auto snapshots (pinned = false) cannot
 * be deleted here — those roll off naturally via the HISTORY_KEEP cap on
 * the item PUT route. Restricting deletes to pinned rows keeps the audit
 * trail honest: an editor can't wipe a specific auto-snapshot to erase
 * evidence of a prior value.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id, historyId } = await params;
  const owns = await prisma.vaultItem.findFirst({
    where: { id, userId: session.userId },
    select: { id: true },
  });
  if (!owns) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const result = await prisma.vaultItemHistory.deleteMany({
    where: { id: historyId, itemId: id, pinned: true },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
