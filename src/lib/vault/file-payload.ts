/**
 * File attachment payload helpers. The `file` custom field stores a JSON
 * blob so filename + type + size travel with the base64 data through the
 * same encrypted ciphertext as every other field.
 */

export interface FilePayload {
  name: string;
  type: string;
  size: number;
  base64: string;
}

// Keep the encoded payload well under the API cipher bound (5 MB).
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

function toBase64(bytes: Uint8Array): string {
  // Chunked encode so we don't overflow the JS argument list on large files.
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function encodeFile(file: File): Promise<FilePayload> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `File is too large (max ${(MAX_FILE_BYTES / (1024 * 1024)).toFixed(1)} MB).`,
    );
  }
  const buf = await file.arrayBuffer();
  return {
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    base64: toBase64(new Uint8Array(buf)),
  };
}

export function decodeFilePayload(raw: string): FilePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FilePayload>;
    if (
      typeof parsed.name === 'string' &&
      typeof parsed.type === 'string' &&
      typeof parsed.size === 'number' &&
      typeof parsed.base64 === 'string'
    ) {
      return parsed as FilePayload;
    }
  } catch {
    // fall through
  }
  return null;
}

export function downloadFile(payload: FilePayload) {
  const bytes = fromBase64(payload.base64);
  const blob = new Blob([bytes as BlobPart], { type: payload.type });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = payload.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
