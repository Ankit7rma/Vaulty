import { z } from 'zod';

/**
 * Validated server-side environment. Import this module for `env.X` instead of
 * touching `process.env` directly: a missing or malformed variable will fail
 * the process at boot rather than at the first request that happens to need it.
 *
 * Client bundles must NOT import this file (it inspects secrets).
 */

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATABASE_URL: z.string().url().min(1),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters (generate with `openssl rand -base64 48`)'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
});

export type Env = z.infer<typeof schema>;

function formatError(error: z.ZodError): string {
  const issues = error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  return `Invalid environment configuration:\n${issues}`;
}

function parse(): Env {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    throw new Error(formatError(result.error));
  }
  return result.data;
}

const isTestRuntime =
  process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

// Under `vitest` tests routinely mutate individual env vars between cases and
// do not exercise the full config (e.g. DATABASE_URL is unused when Prisma is
// mocked). Parse lazily per-access so tests only pay the cost of the fields
// they actually touch, and re-read each time to pick up mutations.
function testProxy(): Env {
  return new Proxy({} as Env, {
    get(_target, prop: string) {
      const key = prop as keyof Env;
      // Only validate the requested field; ignore missing sibling vars.
      const shape = (schema as unknown as { shape: Record<string, z.ZodTypeAny> }).shape;
      const fieldSchema = shape[key];
      if (!fieldSchema) return undefined;
      const parsed = fieldSchema.safeParse(process.env[key]);
      if (!parsed.success) {
        throw new Error(
          formatError(
            new z.ZodError(
              parsed.error.issues.map((i) => ({ ...i, path: [key, ...i.path] })),
            ),
          ),
        );
      }
      return parsed.data;
    },
  });
}

export const env: Env = isTestRuntime ? testProxy() : parse();
