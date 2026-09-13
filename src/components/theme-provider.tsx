'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  isThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme';

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialPreference(): ThemePreference {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref !== 'system') return pref;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function apply(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(readInitialPreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolve(readInitialPreference()),
  );

  // Follow OS theme changes only when the user has picked "system".
  useEffect(() => {
    if (preference !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      const next = mql.matches ? 'dark' : 'light';
      setResolved(next);
      apply(next);
    };
    listener();
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage may be unavailable; the in-memory value still applies.
    }
    const nextResolved = resolve(next);
    setResolved(nextResolved);
    apply(nextResolved);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
