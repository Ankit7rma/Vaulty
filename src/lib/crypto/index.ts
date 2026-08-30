/**
 * Vaulty crypto module: the single source of truth for all client-side
 * cryptography. Pure and isomorphic (no React/DOM coupling) so it is fully
 * unit-testable. Nothing here ever transmits the master password or the key.
 */
export type { EncryptedBlob } from './types';
export {
  utf8ToBytes,
  bytesToUtf8,
  bytesToBase64,
  base64ToBytes,
} from './encoding';
export {
  deriveKey,
  generateSalt,
  isArgon2idAvailable,
  KEY_LENGTH_BYTES,
  SALT_LENGTH_BYTES,
  IV_LENGTH_BYTES,
  MIN_SALT_BYTES,
  DEFAULT_ARGON2_PARAMS,
  DEFAULT_PBKDF2_ITERATIONS,
  type KdfName,
  type Argon2Params,
  type DeriveKeyOptions,
} from './kdf';
export {
  encryptBytes,
  decryptBytes,
  encryptString,
  decryptString,
  encryptJson,
  decryptJson,
} from './cipher';
export { generatePassword, type PasswordOptions } from './password';
export { createVerifyBlob, verifyKey, VERIFY_MARKER } from './verify';
