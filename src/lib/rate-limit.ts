import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Fixed-window rate limiter with two backends:
 *
 * - **Upstash Redis** (production) when UPSTASH_REDIS_REST_URL and
 *   UPSTASH_REDIS_REST_TOKEN are set. Uses INCR + EXPIRE via Upstash's REST
 *   API so no client library is required.
 * - **In-memory Map** (dev/test, and prod fallback) — per-process only, so it
 *   does NOT enforce across serverless function instances. Prod deployments
 *   without Upstash configured will log a warning at first use.
 *
 * `check` returns `{ ok, remaining, resetSeconds }`. The route decides how to
 * respond (usually 429 with a Retry-After header).
 */

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetSeconds: number;
}

export interface RateLimitOptions {
  /** Namespace for this limit (e.g. "auth.login"). */
  name: string;
  /** Maximum requests allowed in the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /** Additional identifier to combine with the IP (e.g. email being logged in as). */
  identifier?: string;
}

function ipFromRequest(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? '0.0.0.0';
}

function bucketKey(request: Request, opts: RateLimitOptions): string {
  const ip = ipFromRequest(request);
  return opts.identifier
    ? `${opts.name}:${ip}:${opts.identifier}`
    : `${opts.name}:${ip}`;
}

// --- In-memory backend -------------------------------------------------------

interface Bucket {
  count: number;
  resetAt: number;
}

const memory = new Map<string, Bucket>();
let warnedAboutMemoryInProd = false;

function checkMemory(key: string, opts: RateLimitOptions): RateLimitResult {
  if (env.NODE_ENV === 'production' && !warnedAboutMemoryInProd) {
    warnedAboutMemoryInProd = true;
    logger.warn('ratelimit.memory_in_production', {
      hint: 'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for durable rate limits.',
    });
  }
  const now = Date.now();
  const bucket = memory.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + opts.windowSeconds * 1000 });
    return { ok: true, remaining: opts.limit - 1, resetSeconds: opts.windowSeconds };
  }
  bucket.count += 1;
  const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);
  if (bucket.count > opts.limit) {
    return { ok: false, remaining: 0, resetSeconds };
  }
  return {
    ok: true,
    remaining: Math.max(0, opts.limit - bucket.count),
    resetSeconds,
  };
}

// --- Upstash Redis REST backend ---------------------------------------------

async function upstashCommand(command: (string | number)[]): Promise<unknown> {
  const url = env.UPSTASH_REDIS_REST_URL!;
  const token = env.UPSTASH_REDIS_REST_TOKEN!;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const data = (await res.json()) as { result: unknown };
  return data.result;
}

async function checkUpstash(
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  try {
    // INCR then set expiry the first time we see the key. Two RTTs but simple
    // and idempotent; pipeline could reduce to one if throughput matters.
    const count = (await upstashCommand(['INCR', key])) as number;
    if (count === 1) {
      await upstashCommand(['EXPIRE', key, opts.windowSeconds]);
    }
    const ttl = (await upstashCommand(['TTL', key])) as number;
    const resetSeconds = ttl > 0 ? ttl : opts.windowSeconds;
    if (count > opts.limit) {
      return { ok: false, remaining: 0, resetSeconds };
    }
    return {
      ok: true,
      remaining: Math.max(0, opts.limit - count),
      resetSeconds,
    };
  } catch (error) {
    // Never let the limiter's own failure lock users out — fall back to
    // in-memory so at least the current instance still enforces something.
    logger.error('ratelimit.upstash_error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return checkMemory(key, opts);
  }
}

// --- Public API --------------------------------------------------------------

export async function rateLimit(
  request: Request,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const key = bucketKey(request, opts);
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return checkUpstash(key, opts);
  }
  return checkMemory(key, opts);
}
