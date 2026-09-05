/**
 * HaveIBeenPwned "Pwned Passwords" check using k-anonymity: we SHA-1 the
 * password locally and send only the first 5 hex characters of the hash to the
 * API. It returns every suffix sharing that prefix; we match the remaining 35
 * characters in the browser. The password (and all but 5 chars of its hash)
 * never leaves the device. `Add-Padding` asks the API to pad the response so
 * the size of the anonymity set is not observable either.
 */

export interface BreachResult {
  breached: boolean;
  count: number;
}

async function sha1Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-1', data);
  let hex = '';
  for (const byte of new Uint8Array(digest)) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex.toUpperCase();
}

export async function checkPasswordBreached(
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BreachResult> {
  if (!password) return { breached: false, count: 0 };

  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const res = await fetchImpl(
    `https://api.pwnedpasswords.com/range/${prefix}`,
    { headers: { 'Add-Padding': 'true' } },
  );
  if (!res.ok) throw new Error('breach check failed');

  const text = await res.text();
  for (const line of text.split('\n')) {
    const [lineSuffix, countStr] = line.trim().split(':');
    if (lineSuffix === suffix) {
      // Padded (fake) entries carry a count of 0.
      const count = Number(countStr);
      return { breached: count > 0, count: count > 0 ? count : 0 };
    }
  }
  return { breached: false, count: 0 };
}
