/**
 * Cryptographically strong password generator. All randomness comes from
 * crypto.getRandomValues, and selection uses rejection sampling so there is no
 * modulo bias toward the start of a character set.
 */

export interface PasswordOptions {
  length: number;
  uppercase?: boolean;
  lowercase?: boolean;
  numbers?: boolean;
  symbols?: boolean;
  /** drop visually confusable characters (0/O, 1/l/I, etc.) */
  excludeAmbiguous?: boolean;
}

const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?',
} as const;

const AMBIGUOUS = new Set(['0', 'O', 'o', '1', 'l', 'I', '|', '`', "'", '"']);

const UINT32_RANGE = 0x1_0000_0000;

/** Uniformly random integer in [0, maxExclusive) with no modulo bias. */
function randomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error('maxExclusive must be a positive integer');
  }
  const limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return value % maxExclusive;
}

function pick(chars: string): string {
  return chars[randomInt(chars.length)];
}

function filterAmbiguous(chars: string, exclude: boolean | undefined): string {
  if (!exclude) return chars;
  return [...chars].filter((c) => !AMBIGUOUS.has(c)).join('');
}

export function generatePassword(options: PasswordOptions): string {
  const { length } = options;
  if (!Number.isInteger(length) || length < 1) {
    throw new Error('length must be a positive integer');
  }

  const enabled: string[] = [];
  if (options.uppercase) enabled.push(CHAR_SETS.uppercase);
  if (options.lowercase) enabled.push(CHAR_SETS.lowercase);
  if (options.numbers) enabled.push(CHAR_SETS.numbers);
  if (options.symbols) enabled.push(CHAR_SETS.symbols);
  if (enabled.length === 0) {
    throw new Error('at least one character set must be enabled');
  }

  const pools = enabled
    .map((set) => filterAmbiguous(set, options.excludeAmbiguous))
    .filter((set) => set.length > 0);
  if (pools.length === 0) {
    throw new Error('no characters available after exclusions');
  }
  const combined = pools.join('');

  const chars: string[] = [];
  // Guarantee at least one character from each enabled set when there is room.
  if (length >= pools.length) {
    for (const pool of pools) chars.push(pick(pool));
  }
  while (chars.length < length) chars.push(pick(combined));

  // Fisher-Yates shuffle so the guaranteed characters are not stuck up front.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
