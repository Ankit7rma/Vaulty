'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from './theme-provider';
import type { ThemePreference } from '@/lib/theme';

const ORDER: ThemePreference[] = ['system', 'light', 'dark'];
const LABEL: Record<ThemePreference, string> = {
  system: 'Follow system',
  light: 'Light theme',
  dark: 'Dark theme',
};

function nextInCycle(current: ThemePreference): ThemePreference {
  const idx = ORDER.indexOf(current);
  return ORDER[(idx + 1) % ORDER.length];
}

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const next = nextInCycle(preference);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => setPreference(next)}
      aria-label={`Switch to ${LABEL[next]}`}
      title={`Current: ${LABEL[preference]}. Click to switch to ${LABEL[next]}.`}
    >
      {preference === 'system' ? (
        <Monitor className="size-4" aria-hidden />
      ) : preference === 'dark' ? (
        <Moon className="size-4" aria-hidden />
      ) : (
        <Sun className="size-4" aria-hidden />
      )}
    </Button>
  );
}
