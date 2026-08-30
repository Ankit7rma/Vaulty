import { argon2id, argon2Verify } from 'hash-wasm';

/**
 * Server-side hashing of the ACCOUNT password (identity only; it never touches
 * the vault key or any vault data). Argon2id via the same wasm implementation
 * as the client-side KDF, so there is no native build dependency and it runs
 * anywhere. The encoded (PHC) output embeds the random salt and cost
 * parameters, so verification needs only the stored hash.
 */

export interface AccountHashParams {
  memorySizeKiB: number;
  iterations: number;
  parallelism: number;
}

/** OWASP-aligned interactive defaults (m = 19 MiB, t = 2, p = 1). */
export const DEFAULT_ACCOUNT_HASH_PARAMS: AccountHashParams = {
  memorySizeKiB: 19_456,
  iterations: 2,
  parallelism: 1,
};

const SALT_BYTES = 16;
const HASH_LENGTH = 32;

export async function hashAccountPassword(
  password: string,
  params: AccountHashParams = DEFAULT_ACCOUNT_HASH_PARAMS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return argon2id({
    password,
    salt,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memorySizeKiB,
    hashLength: HASH_LENGTH,
    outputType: 'encoded',
  });
}

export async function verifyAccountPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  try {
    return await argon2Verify({ password, hash: encodedHash });
  } catch {
    // Malformed stored hash, etc. Treat as a failed match rather than crashing.
    return false;
  }
}
