import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';

// Entry point: route to the right place based on session + onboarding state.
// Whether the vault is actually unlocked is a client-only fact, so /vault
// itself bounces to /unlock when the in-memory key is absent.
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  redirect(user.onboarded ? '/vault' : '/onboard');
}
