/**
 * Per-user login IP allowlist. Kept minimal: IPv4 CIDR ranges only. IPv6
 * addresses (and unrecognized formats) always match so an odd request path
 * never locks a user out. If the caller's IP can't be determined we treat
 * the check as permissive rather than restrictive — the alternative is
 * silently locking users out from mis-configured proxies.
 */

const CIDR_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/;

function toInt(part: string): number | null {
  const n = Number(part);
  if (!Number.isInteger(n) || n < 0 || n > 255) return null;
  return n;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    const n = toInt(part);
    if (n === null) return null;
    out = (out * 256 + n) >>> 0;
  }
  return out;
}

interface ParsedCidr {
  network: number;
  mask: number;
}

function parseCidr(cidr: string): ParsedCidr | null {
  const trimmed = cidr.trim();
  const match = CIDR_RE.exec(trimmed);
  if (!match) return null;
  const [, a, b, c, d, prefix] = match;
  const ip = ipv4ToInt(`${a}.${b}.${c}.${d}`);
  if (ip === null) return null;
  const prefixLength = prefix === undefined ? 32 : Number(prefix);
  if (prefixLength < 0 || prefixLength > 32) return null;
  const mask =
    prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return { network: (ip & mask) >>> 0, mask };
}

/** Public parser: normalizes and validates a single CIDR entry. */
export function normalizeCidr(entry: string): string | null {
  const parsed = parseCidr(entry);
  if (!parsed) return null;
  const trimmed = entry.trim();
  // Preserve the user's typed form; parsing is only used for validity here.
  return trimmed;
}

/** Removes invalid or duplicate entries; caps the list length. */
export function normalizeAllowlist(raw: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const normalized = normalizeCidr(entry);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= 32) break;
  }
  return out;
}

/**
 * Returns true when the address matches any entry (or when the allowlist is
 * empty). Non-IPv4 addresses always match — see module comment for why.
 */
export function isIpAllowed(ip: string | null, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  if (!ip) return true;
  const asInt = ipv4ToInt(ip);
  if (asInt === null) return true;
  for (const entry of allowlist) {
    const parsed = parseCidr(entry);
    if (!parsed) continue;
    if (((asInt & parsed.mask) >>> 0) === parsed.network) return true;
  }
  return false;
}

/** Best-effort IP extraction from Next.js Request headers. */
export function ipFromRequest(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip');
}
