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
  type: z.enum([
    'login',
    'note',
    'card',
    'identity',
    'passport',
    'sshKey',
    'apiKey',
    'license',
    'wifi',
    'bank',
    'crypto',
    'passkey',
    'file',
  ]),
  // Ciphertext can be sizeable for long notes / file attachments; bound it
  // to reject abuse while still allowing modest binary payloads.
  cipher: z.string().min(1).max(5_000_000),
  iv: z.string().min(1).max(1_000),
});

export type ItemInput = z.infer<typeof itemInputSchema>;

/** Validation for creating a one-time share (opaque ciphertext only). */
export const shareInputSchema = z.object({
  cipher: z.string().min(1).max(200_000),
  iv: z.string().min(1).max(1_000),
  // Hours before expiry. 168 = 7 days; 720 = 30 days.
  expiresInHours: z.number().int().min(1).max(720).optional(),
  // Number of times the share can be opened before it self-destructs.
  maxViews: z.number().int().min(1).max(50).optional(),
  // Argon2id salt (base64) when a passphrase gate was added on top of the
  // URL-fragment key. Server stores it opaquely.
  passSalt: z.string().min(1).max(200).optional(),
});

export type ShareInput = z.infer<typeof shareInputSchema>;

/**
 * Rotate the master key: swap the KDF descriptor and, in the same
 * transaction, replace every item's ciphertext with a version encrypted under
 * the new key. All blobs stay opaque to the server.
 */
export const rewrappedItemSchema = z.object({
  id: z.string().min(1).max(64),
  cipher: z.string().min(1).max(5_000_000),
  iv: z.string().min(1).max(1_000),
});

export const rotateMasterKeySchema = z.object({
  // Account (not master) password. Proves the caller knows the identity
  // credential in addition to holding an unlocked session.
  password: z.string().min(1).max(200),
  descriptor: onboardSchema,
  // Every existing VaultItem must appear here, rewrapped. The server rejects
  // the request if the id set does not match, so a mid-flight create on
  // another device fails the rotation instead of orphaning an item.
  items: z.array(rewrappedItemSchema).max(100_000),
});

export type RotateMasterKeyInput = z.infer<typeof rotateMasterKeySchema>;

/**
 * Validation for creating a shared vault. The creator provides an already-
 * encrypted display name (only members can decrypt) and the raw AES-GCM vault
 * key wrapped with their own RSA public key (so they can unwrap it later).
 */
export const createSharedVaultSchema = z.object({
  name: z.string().min(1).max(10_000),
  nameIv: z.string().min(1).max(200),
  wrappedKey: z.string().min(1).max(10_000),
});

export type CreateSharedVaultInput = z.infer<typeof createSharedVaultSchema>;

/** Roles for shared-vault memberships and invites. Matches the Prisma enum. */
export const sharedVaultRoleSchema = z.enum(['owner', 'editor', 'reader']);
export type SharedVaultRole = z.infer<typeof sharedVaultRoleSchema>;

/**
 * Creating an invitation: recipient email, target role, and the vault key
 * already wrapped with the recipient's public key. Owner cannot invite as
 * "owner"; ownership transfer is a separate flow.
 */
export const createInviteSchema = z.object({
  email: z.string().min(3).max(320).email(),
  role: z.enum(['editor', 'reader']),
  wrappedKey: z.string().min(1).max(10_000),
  expiresInHours: z.number().int().min(1).max(30 * 24).optional(),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
