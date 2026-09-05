import 'server-only';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from './cookies';

/**
 * Server-component auth helpers. `onboarded` means the user has set a master
 * password (kdfSalt is present); it says nothing about whether the vault is
 * currently unlocked, since the in-memory key lives only on the client.
 */

export interface CurrentUser {
  id: string;
  email: string;
  onboarded: boolean;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, kdfSalt: true },
  });
  if (!user) return null;

  return { id: user.id, email: user.email, onboarded: user.kdfSalt !== null };
}

/** Redirect to /login when there is no valid session. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}
