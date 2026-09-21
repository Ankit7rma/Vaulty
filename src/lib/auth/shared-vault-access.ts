import { prisma } from '@/lib/db';
import type { SharedVaultRole } from '@/lib/vault/schemas';

/**
 * Resolve the caller's role in a shared vault, or null if they aren't a
 * member. Cheap: single indexed lookup on (sharedVaultId, userId).
 *
 * All shared-vault APIs authorize through this helper so role checks live in
 * one place. The role enum matches the Prisma type — cast is safe.
 */
export async function getSharedVaultRole(
  userId: string,
  sharedVaultId: string,
): Promise<SharedVaultRole | null> {
  const membership = await prisma.sharedVaultMembership.findUnique({
    where: { sharedVaultId_userId: { sharedVaultId, userId } },
    select: { role: true },
  });
  return (membership?.role as SharedVaultRole | undefined) ?? null;
}

/** True if the role allows writing (create/update/delete items, invite, etc). */
export function canWrite(role: SharedVaultRole): boolean {
  return role === 'owner' || role === 'editor';
}

/** True if the role can manage members (invite/remove/change role/transfer). */
export function canManage(role: SharedVaultRole): boolean {
  return role === 'owner';
}
