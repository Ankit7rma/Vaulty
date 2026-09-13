import { env } from '@/lib/env';

/**
 * Minimal structured JSON logger. Emits one JSON line per event so hosting
 * platforms (Vercel, Fly, CloudWatch) can parse and index them. No external
 * dependencies; sits on top of console.* which Vercel already captures.
 *
 * Usage in an API route:
 *
 *   const log = logger.forRequest(request);
 *   log.info('login.attempt', { email });
 *   log.error('login.failed', { reason: 'invalid_password' });
 *
 * NEVER pass raw secrets, cookies, master passwords, cipher blobs, or the
 * request body — the fields log values verbatim into JSON.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

interface Logger {
  debug(event: string, fields?: Fields): void;
  info(event: string, fields?: Fields): void;
  warn(event: string, fields?: Fields): void;
  error(event: string, fields?: Fields): void;
  child(bindings: Fields): Logger;
  forRequest(req: Request): Logger;
}

const LEVEL_RANK: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function minLevel(): number {
  if (env.NODE_ENV === 'production') return LEVEL_RANK.info;
  return LEVEL_RANK.debug;
}

function emit(level: Level, event: string, bindings: Fields, fields?: Fields) {
  if (LEVEL_RANK[level] < minLevel()) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...bindings,
    ...fields,
  };
  const target =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  target(JSON.stringify(line));
}

function make(bindings: Fields = {}): Logger {
  return {
    debug: (event, fields) => emit('debug', event, bindings, fields),
    info: (event, fields) => emit('info', event, bindings, fields),
    warn: (event, fields) => emit('warn', event, bindings, fields),
    error: (event, fields) => emit('error', event, bindings, fields),
    child: (extra) => make({ ...bindings, ...extra }),
    forRequest: (req) => {
      const requestId =
        req.headers.get('x-vercel-id') ??
        req.headers.get('x-request-id') ??
        crypto.randomUUID();
      const url = new URL(req.url);
      return make({
        ...bindings,
        requestId,
        method: req.method,
        path: url.pathname,
      });
    },
  };
}

export const logger = make();
export type { Logger };
