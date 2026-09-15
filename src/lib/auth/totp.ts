import { generateTotp } from '@/lib/vault/totp';

/**
 * Server-side TOTP helpers for account 2FA. Uses the same RFC 6238 codec as
 * the item-level TOTP feature, plus:
 *   - `generateBase32Secret` for enrollment (160-bit secret, Google
 *     Authenticator compatible)
 *   - `buildOtpauthUri` to hand a provisioning URI to the client for QR
 *   - `verifyTotpCode` that accepts a small (+/-1 step) skew window to
 *     tolerate clock drift between the user's phone and the server
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function bytesToBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

/** 160-bit base32 secret. Matches Google Authenticator's default enrollment. */
export function generateBase32Secret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return bytesToBase32(bytes);
}

export function buildOtpauthUri(
  issuer: string,
  account: string,
  secret: string,
): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Verifies a code against the secret, allowing +/-1 step (30s each side) to
 * tolerate clock drift. Returns false on any format issue.
 */
export async function verifyTotpCode(
  secret: string,
  code: string,
): Promise<boolean> {
  const normalized = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const now = Date.now();
  const period = 30;
  for (const offset of [0, -period, period] as const) {
    const expected = await generateTotp(secret, {
      timestamp: now + offset * 1000,
      period,
      digits: 6,
    });
    if (constantTimeEquals(expected, normalized)) return true;
  }
  return false;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
