'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type AppSettings,
} from './settings';

const STORAGE_KEY = 'vaulty.settings';

interface SettingsContextValue extends AppSettings {
  update: (patch: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function readStored(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Lazy init from localStorage. No settings-dependent DOM is rendered during
  // hydration (the vault is locked on first paint), so this avoids both a
  // hydration mismatch and a setState-in-effect.
  const [settings, setSettings] = useState<AppSettings>(readStored);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = normalizeSettings({ ...prev, ...patch });
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage can be unavailable (private mode); keep the in-memory value.
      }
      return next;
    });
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ ...settings, update }),
    [settings, update],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}
