import { z } from 'zod';

/** Request-body validation for the auth endpoints. */

// Normalize first (trim + lowercase), then validate the email format, so inputs
// with surrounding whitespace or mixed case are accepted and stored canonically.
const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const signupSchema = z.object({
  email,
  // Account password: distinct from the master password. 8+ chars; the upper
  // bound just guards against absurd inputs.
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
