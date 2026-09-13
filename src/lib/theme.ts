/**
 * Theme selection persisted per-device. `"system"` follows the OS-level
 * prefers-color-scheme; `"light"` and `"dark"` pin the choice.
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'vaulty.theme';
export const DEFAULT_THEME: ThemePreference = 'system';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * Inline script run before hydration to apply the persisted theme so users
 * never see a flash of the wrong palette. Written as a string so it can be
 * embedded via dangerouslySetInnerHTML in the root layout.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var key = '${THEME_STORAGE_KEY}';
    var stored = localStorage.getItem(key);
    var pref = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    var mql = window.matchMedia('(prefers-color-scheme: dark)');
    var resolved = pref === 'system' ? (mql.matches ? 'dark' : 'light') : pref;
    var root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
  } catch (_) {}
})();
`.trim();
