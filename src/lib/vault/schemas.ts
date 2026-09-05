import { z } from 'zod';

/** Validation for the vault key-setup endpoint. */

// Opaque base64 blobs (salt, ciphertext, iv). Bounded to reject absurd inputs.
const b64 = z.string().min(1).max(10_000);

// strictObject so a payload can't smuggle the wrong KDF's params through (zod's
// default object() would silently strip unknown keys).
const argon2Params = z.strictObject({
  memorySizeKiB: z.number().int().positive().max(1_048_576),
  iterations: z.number().int().positive().max(100),
  parallelism: z.number().int().positive().max(64),
});

const pbkdf2Params = z.strictObject({
  iterations: z.number().int().positive().max(10_000_000),
});

export const onboardSchema = z.discriminatedUnion('kdfName', [
  z.object({
    kdfName: z.literal('argon2id'),
    kdfParams: argon2Params,
    kdfSalt: b64,
    verifyBlob: b64,
    verifyIv: b64,
  }),
  z.object({
    kdfName: z.literal('pbkdf2'),
    kdfParams: pbkdf2Params,
    kdfSalt: b64,
    verifyBlob: b64,
    verifyIv: b64,
  }),
]);

export type OnboardInput = z.infer<typeof onboardSchema>;

/** Validation for creating/updating a vault item. Only opaque data is accepted. */
export const itemInputSchema = z.object({
  type: z.enum(['login', 'note']),
  // Ciphertext can be sizeable for long notes; bound it to reject abuse.
  cipher: z.string().min(1).max(200_000),
  iv: z.string().min(1).max(1_000),
});

export type ItemInput = z.infer<typeof itemInputSchema>;
