import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getRpConfig } from '@/lib/auth/passkeys';
import { setChallengeCookie } from '@/lib/auth/passkey-challenge';

/**
 * Anonymous authentication: we do not know which user is logging in, so we
 * ask the browser to discover a credential. The Relying Party accepts any
 * credential registered for this domain, then looks up the user from the
 * returned credentialId.
 */
export async function POST() {
  const { rpID } = getRpConfig();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: [],
  });
  await setChallengeCookie({ challenge: options.challenge });
  return NextResponse.json(options);
}
