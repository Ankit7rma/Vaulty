import { z } from 'zod';
import { estimateStrength } from '@/lib/vault/password-strength';

/** Request-body validation for the auth endpoints. */

// Normalize first (trim + lowercase), then validate the email format, so inputs
// with surrounding whitespace or mixed case are accepted and stored canonically.
const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

// Minimum acceptable zxcvbn score for the account password. 0 = trivially
// guessable, 4 = essentially unguessable. Score 2 rejects the most common
// leaked-password lists while remaining humane.
const MIN_STRENGTH_SCORE = 2;

const accountPassword = z
  .string()
  .min(8, 'Account password must be at least 8 characters')
  .max(200)
  .superRefine((value, ctx) => {
    if (estimateStrength(value).score < MIN_STRENGTH_SCORE) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Account password is too easy to guess. Mix in more letters, numbers, or symbols.',
      });
    }
  });

export const signupSchema = z.object({
  email,
  password: accountPassword,
});

export const loginSchema = z.object({
  email,
  // Login does not re-validate strength; existing accounts should still be
  // able to sign in even if their password predates the strength policy.
  password: z.string().min(1).max(200),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
