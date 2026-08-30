import type { EncryptedBlob } from './types';
import { decryptString, encryptString } from './cipher';

/**
 * The "check blob". At enrolment we seal a constant marker under the vault key
 * and store the resulting blob on the server. To verify a master password on
 * unlock, we re-derive the key and try to decrypt the blob back to the marker,
 * entirely client-side. Nothing derived from the master password is ever sent
 * to the server for comparison.
 */

export const VERIFY_MARKER = 'vaulty:verify:v1';

export async function createVerifyBlob(key: CryptoKey): Promise<EncryptedBlob> {
  return encryptString(key, VERIFY_MARKER);
}

export async function verifyKey(
  key: CryptoKey,
  blob: EncryptedBlob,
): Promise<boolean> {
  try {
    const decrypted = await decryptString(key, blob);
    return decrypted === VERIFY_MARKER;
  } catch {
    // AES-GCM authentication failure => wrong key (or tampered blob).
    return false;
  }
}
