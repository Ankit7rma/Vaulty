import {
  deriveKey,
  generateSalt,
  isArgon2idAvailable,
  createVerifyBlob,
  verifyKey,
  bytesToBase64,
  base64ToBytes,
  DEFAULT_ARGON2_PARAMS,
  DEFAULT_PBKDF2_ITERATIONS,
  type Argon2Params,
  type DeriveKeyOptions,
  type EncryptedBlob,
} from '@/lib/crypto';

/**
 * Bridges the pure crypto module and the app's onboarding/unlock flows. All of
 * this runs in the browser: the master password never leaves the client, and
 * only the public KDF descriptor + opaque check blob are sent to the server.
 */

export type KdfName = 'argon2id' | 'pbkdf2';
export type KdfParams = Argon2Params | { iterations: number };

/** Everything the server persists so the key can be re-derived and verified. */
export interface KeyDescriptor {
  kdfSalt: string; // base64
  kdfName: KdfName;
  kdfParams: KdfParams;
  verifyBlob: string; // base64 ciphertext
  verifyIv: string; // base64 iv
}

function deriveOptions(kdfName: KdfName, kdfParams: KdfParams): DeriveKeyOptions {
  if (kdfName === 'argon2id') {
    return { kdf: 'argon2id', argon2: kdfParams as Argon2Params };
  }
  return {
    kdf: 'pbkdf2',
    pbkdf2Iterations: (kdfParams as { iterations: number }).iterations,
  };
}

/**
 * First-time setup: pick the strongest available KDF, derive the key, and seal
 * a check blob. Returns the in-memory key plus the descriptor to POST.
 */
export async function enrollMasterKey(
  masterPassword: string,
): Promise<{ key: CryptoKey; descriptor: KeyDescriptor }> {
  const salt = generateSalt();
  const useArgon = await isArgon2idAvailable();
  const kdfName: KdfName = useArgon ? 'argon2id' : 'pbkdf2';
  const kdfParams: KdfParams = useArgon
    ? DEFAULT_ARGON2_PARAMS
    : { iterations: DEFAULT_PBKDF2_ITERATIONS };

  const key = await deriveKey(masterPassword, salt, deriveOptions(kdfName, kdfParams));
  const blob = await createVerifyBlob(key);

  return {
    key,
    descriptor: {
      kdfSalt: bytesToBase64(salt),
      kdfName,
      kdfParams,
      verifyBlob: blob.cipher,
      verifyIv: blob.iv,
    },
  };
}

/**
 * Unlock: re-derive the key from the stored descriptor and verify it against
 * the check blob. Returns the key on success, or null for a wrong password.
 */
export async function deriveAndVerify(
  masterPassword: string,
  descriptor: KeyDescriptor,
): Promise<CryptoKey | null> {
  const salt = base64ToBytes(descriptor.kdfSalt);
  const key = await deriveKey(
    masterPassword,
    salt,
    deriveOptions(descriptor.kdfName, descriptor.kdfParams),
  );
  const blob: EncryptedBlob = {
    cipher: descriptor.verifyBlob,
    iv: descriptor.verifyIv,
  };
  return (await verifyKey(key, blob)) ? key : null;
}
