/**
 * The only shape the server ever stores for a secret: two base64 strings.
 * There is no field here that could reveal plaintext without the vault key.
 */
export interface EncryptedBlob {
  /** base64 AES-GCM ciphertext (includes the 128-bit authentication tag). */
  cipher: string;
  /** base64 12-byte random IV, unique per ciphertext. */
  iv: string;
}
