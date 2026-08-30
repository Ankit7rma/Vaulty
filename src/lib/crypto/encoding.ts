/**
 * Byte <-> string encoders shared by the crypto module. Deliberately dependency
 * free and isomorphic: TextEncoder/TextDecoder and btoa/atob are global in both
 * the browser and Node 22, so the same code runs in the app and in tests.
 */

/**
 * A byte view guaranteed to be backed by a plain ArrayBuffer. Web Crypto's
 * BufferSource rejects the default `Uint8Array<ArrayBufferLike>` (which could be
 * a SharedArrayBuffer), so byte producers in this module return `Bytes`.
 */
export type Bytes = Uint8Array<ArrayBuffer>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function utf8ToBytes(text: string): Bytes {
  // encoder.encode() is typed as ArrayBufferLike-backed; copy into a plain
  // ArrayBuffer-backed view so the result satisfies BufferSource.
  return new Uint8Array(encoder.encode(text));
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

export function bytesToBase64(bytes: Uint8Array): string {
  // Chunked to stay well under the argument-count limit of fromCharCode for
  // large payloads (e.g. a big secure note).
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Bytes {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
