import { SharedItemView } from '@/components/share/shared-item-view';

// Public page: no auth. The decryption key is only in the URL fragment, which
// the browser never sends here, so the server renders a shell and the client
// fetches + decrypts.
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SharedItemView token={token} />;
}
