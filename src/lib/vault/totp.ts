/**
 * TOTP (RFC 6238) generation, entirely client-side. The secret is stored
 * encrypted inside the item blob like every other field; codes are derived in
 * the browser with HMAC-SHA1 via Web Crypto.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('invalid base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

/** Accepts a bare base32 secret or an otpauth:// URI; returns the base32 secret. */
export function normalizeTotpSecret(input: string): string {
  const trimmed = input.trim();
  if (trimmed.toLowerCase().startsWith('otpauth://')) {
    try {
      const secret = new URL(trimmed).searchParams.get('secret');
      if (secret) return secret.replace(/\s/g, '').toUpperCase();
    } catch {
      // fall through to treating the whole string as a secret
    }
  }
  return trimmed.replace(/\s/g, '').toUpperCase();
}

export function isValidTotpSecret(secret: string): boolean {
  try {
    return base32Decode(normalizeTotpSecret(secret)).length > 0;
  } catch {
    return false;
  }
}

export interface TotpOptions {
  timestamp?: number; // ms since epoch
  period?: number; // seconds
  digits?: number;
}

export async function generateTotp(
  secret: string,
  options: TotpOptions = {},
): Promise<string> {
  const period = options.period ?? 30;
  const digits = options.digits ?? 6;
  const timestamp = options.timestamp ?? Date.now();

  const keyBytes = base32Decode(normalizeTotpSecret(secret));
  let counter = Math.floor(timestamp / 1000 / period);
  const counterBytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i -= 1) {
    counterBytes[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(keyBytes),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', cryptoKey, new Uint8Array(counterBytes)),
  );

  // RFC 4226 dynamic truncation.
  const offset = sig[19] & 0x0f;
  const binary =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);

  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

/** Seconds left in the current TOTP window. */
export function totpRemainingSeconds(
  timestamp: number = Date.now(),
  period = 30,
): number {
  return period - (Math.floor(timestamp / 1000) % period);
}
