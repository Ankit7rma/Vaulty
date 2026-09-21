import {
  KEYPAIR_ALG,
  exportPublicKey,
  generateWrappingKeypair,
  importPublicKey,
  unwrapPrivateKey,
  wrapPrivateKey,
} from '@/lib/crypto';

/**
 * Bridges the pure crypto keypair helpers and the app's stored-descriptor flow.
 * The server holds the public key in the clear (safe by design) plus the
 * private key wrapped under the user's vault key (ciphertext only). This
 * module handles the "load or lazily create" cycle used the first time the
 * user touches a shared vault.
 */

export interface StoredKeypair {
  publicKey: string | null;
  wrappedPrivateKey: string | null;
  wrappedPrivateKeyIv: string | null;
  keypairAlg: string | null;
}

export interface LiveKeypair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeySpki: string;
}

async function fetchStored(): Promise<StoredKeypair> {
  const res = await fetch('/api/auth/keypair', { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load your keypair.');
  return (await res.json()) as StoredKeypair;
}

/**
 * Ensure the current user has a wrapping keypair enrolled. If not, generate
 * one, wrap the private key with the vault key, and POST both. Returns the
 * in-memory keys ready to encrypt/decrypt vault-key wraps.
 *
 * Idempotent: safe to call before every shared-vault flow.
 */
export async function ensureKeypair(vaultKey: CryptoKey): Promise<LiveKeypair> {
  const stored = await fetchStored();
  if (
    stored.publicKey &&
    stored.wrappedPrivateKey &&
    stored.wrappedPrivateKeyIv &&
    stored.keypairAlg
  ) {
    const publicKey = await importPublicKey(stored.publicKey);
    const privateKey = await unwrapPrivateKey(
      { cipher: stored.wrappedPrivateKey, iv: stored.wrappedPrivateKeyIv },
      vaultKey,
    );
    return { publicKey, privateKey, publicKeySpki: stored.publicKey };
  }

  const pair = await generateWrappingKeypair();
  const publicKeySpki = await exportPublicKey(pair.publicKey);
  const wrapped = await wrapPrivateKey(pair.privateKey, vaultKey);
  const res = await fetch('/api/auth/keypair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: publicKeySpki,
      wrappedPrivateKey: wrapped.cipher,
      wrappedPrivateKeyIv: wrapped.iv,
      keypairAlg: KEYPAIR_ALG,
    }),
  });
  if (!res.ok) {
    // Another tab may have raced us and enrolled first. Re-fetch and unwrap.
    if (res.status === 409) {
      return ensureKeypair(vaultKey);
    }
    throw new Error('Could not save your keypair.');
  }
  // Re-import the public key so both fields are always non-extractable
  // CryptoKeys sourced the same way as the load path.
  const publicKey = await importPublicKey(publicKeySpki);
  const privateKey = await unwrapPrivateKey(wrapped, vaultKey);
  return { publicKey, privateKey, publicKeySpki };
}
