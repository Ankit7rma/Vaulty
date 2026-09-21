import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/cookies';
import { ClaimView } from '@/components/invite/claim-view';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Shared vault invite',
};

/**
 * Landing page for signed invite links. If the user isn't signed in yet, we
 * bounce them through /login with a `?next=/invite/<token>` so they end up
 * back here as themselves. Everything else (fetching the preview, showing
 * the accept UI, calling claim) happens client-side.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=/invite/${encodeURIComponent(token)}`);
  }
  return <ClaimView token={token} />;
}
