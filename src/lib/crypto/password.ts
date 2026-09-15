/**
 * Cryptographically strong password generator. All randomness comes from
 * crypto.getRandomValues, and selection uses rejection sampling so there is no
 * modulo bias toward the start of a character set.
 */

import { WORD_LIST } from './wordlist';

export interface PasswordOptions {
  length: number;
  uppercase?: boolean;
  lowercase?: boolean;
  numbers?: boolean;
  symbols?: boolean;
  /** drop visually confusable characters (0/O, 1/l/I, etc.) */
  excludeAmbiguous?: boolean;
  /** Explicit characters to remove from every enabled set. */
  excludeChars?: string;
  /** Override the built-in symbol set with a custom one. */
  customSymbols?: string;
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

function filterExcluded(chars: string, exclude: string | undefined): string {
  if (!exclude) return chars;
  const set = new Set([...exclude]);
  return [...chars].filter((c) => !set.has(c)).join('');
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
  if (options.symbols) {
    enabled.push(options.customSymbols?.trim() || CHAR_SETS.symbols);
  }
  if (enabled.length === 0) {
    throw new Error('at least one character set must be enabled');
  }

  const pools = enabled
    .map((set) => filterAmbiguous(set, options.excludeAmbiguous))
    .map((set) => filterExcluded(set, options.excludeChars))
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

export interface PassphraseOptions {
  words: number;
  separator?: string;
  capitalize?: boolean;
  /** Append a random 1-4 digit number for a bit more entropy. */
  includeNumber?: boolean;
}

export interface PronounceableOptions {
  syllables: number;
  separator?: string;
  capitalize?: boolean;
  includeNumber?: boolean;
}

// English-frequency-weighted consonants/vowels for realistic-sounding output.
// "y" appears in both sides intentionally since it functions as both.
const CONSONANTS = 'bcdfghjklmnpqrstvwxyz';
const VOWELS = 'aeiouy';

/**
 * Diceware-style passphrase. Each word is chosen uniformly from WORD_LIST
 * with rejection sampling (no modulo bias). Default 5 words = ~45 bits.
 */
export function generatePassphrase(options: PassphraseOptions): string {
  const { words } = options;
  if (!Number.isInteger(words) || words < 2 || words > 12) {
    throw new Error('words must be an integer between 2 and 12');
  }
  const separator = options.separator ?? '-';
  const picks: string[] = [];
  for (let i = 0; i < words; i++) {
    let word = WORD_LIST[randomInt(WORD_LIST.length)];
    if (options.capitalize) {
      word = word[0].toUpperCase() + word.slice(1);
    }
    picks.push(word);
  }
  if (options.includeNumber) {
    picks.push(String(randomInt(10_000)));
  }
  return picks.join(separator);
}

/**
 * Pronounceable password: alternating consonant/vowel/consonant syllables
 * ("da-vok-tin-fez") that are easy to read aloud. Entropy per syllable is
 * ~log2(21*6*21) = ~11.4 bits, so a 5-syllable output clears 57 bits.
 */
export function generatePronounceable(options: PronounceableOptions): string {
  const { syllables } = options;
  if (!Number.isInteger(syllables) || syllables < 2 || syllables > 10) {
    throw new Error('syllables must be an integer between 2 and 10');
  }
  const separator = options.separator ?? '-';
  const parts: string[] = [];
  for (let i = 0; i < syllables; i++) {
    let syllable = pick(CONSONANTS) + pick(VOWELS) + pick(CONSONANTS);
    if (options.capitalize) {
      syllable = syllable[0].toUpperCase() + syllable.slice(1);
    }
    parts.push(syllable);
  }
  if (options.includeNumber) {
    parts.push(String(randomInt(1_000)));
  }
  return parts.join(separator);
}
