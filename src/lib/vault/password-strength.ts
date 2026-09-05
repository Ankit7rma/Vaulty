import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as common from '@zxcvbn-ts/language-common';
import * as en from '@zxcvbn-ts/language-en';

/**
 * Password strength estimation via zxcvbn-ts. Runs entirely client-side on the
 * plaintext password; nothing is sent anywhere. The factory (with its
 * dictionaries) is built lazily on first use.
 */

let factory: ZxcvbnFactory | null = null;

function getFactory(): ZxcvbnFactory {
  if (!factory) {
    factory = new ZxcvbnFactory({
      dictionary: { ...common.dictionary, ...en.dictionary },
      graphs: common.adjacencyGraphs,
      translations: en.translations,
    });
  }
  return factory;
}

export type StrengthScore = 0 | 1 | 2 | 3 | 4;

export interface Strength {
  score: StrengthScore;
  label: string;
}

const LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'] as const;

export function estimateStrength(password: string): Strength {
  if (!password) return { score: 0, label: LABELS[0] };
  const score = getFactory().check(password).score as StrengthScore;
  return { score, label: LABELS[score] };
}
