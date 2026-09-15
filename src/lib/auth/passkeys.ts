import { env } from '@/lib/env';

/**
 * WebAuthn Relying Party settings derived from APP_URL unless explicitly
 * overridden. RP ID must match the effective domain of the origin the
 * ceremony runs on, so this deliberately mirrors the browser's view of the
 * host.
 */
export function getRpConfig(): { rpID: string; origin: string } {
  const origin = env.WEBAUTHN_RP_ORIGIN ?? env.APP_URL;
  const rpID = env.WEBAUTHN_RP_ID ?? new URL(origin).hostname;
  return { rpID, origin };
}

export const RP_NAME = 'Vaulty';

// --- Byte helpers -----------------------------------------------------------

/**
 * @simplewebauthn stores public keys as Uint8Array. Prisma's Bytes column
 * gives us back a Node Buffer (which is a Uint8Array subclass but with a
 * different backing type). Normalize both directions so type checks pass and
 * we never accidentally leak the extra Buffer surface.
 */
export function bytesFromDb(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

export function bytesForDb(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}
