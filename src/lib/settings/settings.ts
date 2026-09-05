/**
 * Non-sensitive client preferences. Kept on the device (localStorage); they
 * never touch vault data, so per-device storage is fine and avoids server
 * round-trips. A value of 0 means "never" for both timeouts.
 */

export interface AppSettings {
  autoLockMinutes: number;
  clipboardClearSeconds: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoLockMinutes: 5,
  clipboardClearSeconds: 20,
};

// Choices offered in the settings UI (0 = never).
export const AUTO_LOCK_OPTIONS = [1, 5, 15, 30, 0] as const;
export const CLIPBOARD_OPTIONS = [10, 20, 30, 60, 0] as const;

const AUTO_LOCK_MAX_MINUTES = 24 * 60;
const CLIPBOARD_MAX_SECONDS = 600;

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/** Coerce arbitrary/persisted input into valid settings. */
export function normalizeSettings(raw: unknown): AppSettings {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    autoLockMinutes: clampInt(
      obj.autoLockMinutes,
      0,
      AUTO_LOCK_MAX_MINUTES,
      DEFAULT_SETTINGS.autoLockMinutes,
    ),
    clipboardClearSeconds: clampInt(
      obj.clipboardClearSeconds,
      0,
      CLIPBOARD_MAX_SECONDS,
      DEFAULT_SETTINGS.clipboardClearSeconds,
    ),
  };
}
