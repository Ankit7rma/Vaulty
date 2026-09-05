'use client';

import { useEffect } from 'react';

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
];

/**
 * Locks the vault after `minutes` of inactivity by calling `onLock`. Any user
 * activity resets the countdown. Pass minutes <= 0 to disable ("never").
 */
export function useAutoLock(minutes: number, onLock: () => void) {
  useEffect(() => {
    if (minutes <= 0) return;
    const timeoutMs = minutes * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(onLock, timeoutMs);
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, reset, { passive: true });
    }
    reset();

    return () => {
      clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, reset);
      }
    };
  }, [minutes, onLock]);
}
